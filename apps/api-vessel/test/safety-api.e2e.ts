import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let chiefToken = '';
const ctx = { tenantId: '', vesselId: '' };

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue({ putJobHistoryPhoto: async () => 'stub/key', put: async () => 'stub/key' })
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const tenantRes = await request(app.getHttpServer())
    .post('/api/v1/tenants')
    .send({
      name: 'safety-api-vessel',
      admin: { email: 'admin@safety-vessel.test', password: 'AdminP@ss1' },
    });
  ctx.tenantId = tenantRes.body.tenant.id as string;

  const adminLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId: ctx.tenantId, email: 'admin@safety-vessel.test', password: 'AdminP@ss1' });
  const adminToken = adminLogin.body.access_token as string;

  const vesselRes = await request(app.getHttpServer())
    .post('/api/v1/vessels')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'MV Safety Vessel' });
  ctx.vesselId = vesselRes.body.id as string;

  await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: 'chief@safety-vessel.test',
      password: 'TestP@ss!1',
      role: 'CHIEF_ENGINEER',
      vesselId: ctx.vesselId,
    });

  const chiefLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId: ctx.tenantId, email: 'chief@safety-vessel.test', password: 'TestP@ss!1' });
  chiefToken = chiefLogin.body.access_token as string;
});

afterAll(async () => {
  await app.close();
});

describe('P2-2 safety API — vessel', () => {
  let drillTypeId: string;
  let drillId: string;
  let hotWorkPermitId: string;

  it('creates and lists a DrillType', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/drill-types')
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ name: 'Abandon Ship', description: 'Full muster drill' });
    expect(res.status).toBe(201);
    drillTypeId = (res.body as { id: string }).id;

    const list = await request(app.getHttpServer())
      .get('/api/v1/drill-types')
      .set('Authorization', `Bearer ${chiefToken}`);
    expect(list.status).toBe(200);
    expect((list.body as { id: string }[]).some((d) => d.id === drillTypeId)).toBe(true);
  });

  it('creates a Drill and adds a participant', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/drills')
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({
        vesselId: ctx.vesselId,
        drillTypeId,
        scheduledAt: new Date('2026-07-01T08:00:00Z').toISOString(),
        leadOfficer: 'Chief Officer',
      });
    expect(res.status).toBe(201);
    drillId = (res.body as { id: string }).id;
    expect((res.body as { status: string }).status).toBe('SCHEDULED');

    const rec = await request(app.getHttpServer())
      .post(`/api/v1/drills/${drillId}/records`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ participantName: 'A. Visser', role: 'Officer' });
    expect(rec.status).toBe(201);
  });

  it('marks Drill as COMPLETED', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/drills/${drillId}`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ status: 'COMPLETED', conductedAt: new Date().toISOString(), durationMinutes: 30 });
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe('COMPLETED');
  });

  it('creates a PermitTemplate for HOT_WORK', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/permit-templates')
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({
        permitType: 'HOT_WORK',
        name: 'Hot Work Checklist',
        checklistItemsJson: JSON.stringify([
          { itemId: '1', description: 'Area clear', checked: false },
        ]),
      });
    expect(res.status).toBe(201);
  });

  it('creates HOT_WORK permit, approves, rejects activation without risk assessment', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/v1/work-permits')
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ vesselId: ctx.vesselId, permitType: 'HOT_WORK', title: 'Cutting deck plates' });
    expect(create.status).toBe(201);
    hotWorkPermitId = (create.body as { id: string }).id;

    const approve = await request(app.getHttpServer())
      .post(`/api/v1/work-permits/${hotWorkPermitId}/approve`)
      .set('Authorization', `Bearer ${chiefToken}`);
    expect(approve.status).toBe(201);
    expect((approve.body as { status: string }).status).toBe('APPROVED');

    const badActivate = await request(app.getHttpServer())
      .post(`/api/v1/work-permits/${hotWorkPermitId}/activate`)
      .set('Authorization', `Bearer ${chiefToken}`);
    expect(badActivate.status).toBe(400);
    expect((badActivate.body as { message: string }).message).toMatch(/risk assessment/i);
  });

  it('activates HOT_WORK after completing risk assessment, then closes', async () => {
    const items = JSON.stringify([{ itemId: '1', description: 'Area clear', checked: true }]);
    await request(app.getHttpServer())
      .patch(`/api/v1/work-permits/${hotWorkPermitId}`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ riskAssessmentJson: items });

    const activate = await request(app.getHttpServer())
      .post(`/api/v1/work-permits/${hotWorkPermitId}/activate`)
      .set('Authorization', `Bearer ${chiefToken}`);
    expect(activate.status).toBe(201);
    expect((activate.body as { status: string }).status).toBe('ACTIVE');

    const close = await request(app.getHttpServer())
      .post(`/api/v1/work-permits/${hotWorkPermitId}/close`)
      .set('Authorization', `Bearer ${chiefToken}`);
    expect(close.status).toBe(201);
    expect((close.body as { status: string }).status).toBe('CLOSED');
  });

  it('confirms sync outbox entries were written for Drill and WorkPermit', async () => {
    const { DrizzleService } = await import('../src/db/drizzle.service');
    const drizzle = app.get(DrizzleService);
    const { outbox } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const drillEntries = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityType, 'Drill'))
      .all();
    expect(drillEntries.length).toBeGreaterThan(0);
    const wpEntries = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityType, 'WorkPermit'))
      .all();
    expect(wpEntries.length).toBeGreaterThan(0);
  });
});
