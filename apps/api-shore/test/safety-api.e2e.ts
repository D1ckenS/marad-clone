import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let prisma: PrismaService;
let token: string;

const tenantId = ulid();
const vesselId = ulid();
const userId = ulid();

const storageStub = { putJobHistoryPhoto: async () => 'stub/key', put: async () => 'stub/key' };

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue(storageStub)
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  prisma = moduleRef.get(PrismaService);

  const hash = await bcrypt.hash('TestP@ss!1', 12);
  await prisma.tenant.create({ data: { id: tenantId, name: 'safety-api-shore-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Safety Shore' } });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      vesselId,
      email: 'safety@shore.test',
      passwordHash: hash,
      role: 'CHIEF_ENGINEER',
    },
  });

  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'safety@shore.test', password: 'TestP@ss!1' });
  token = (loginRes.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma.permitApproval.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.workPermit.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.permitTemplate.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.drillRecord.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.drill.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.drillType.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('P2-2 safety API — shore', () => {
  let drillTypeId: string;
  let drillId: string;
  let permitTemplateId: string;
  let hotWorkPermitId: string;
  let coldWorkPermitId: string;

  it('creates a DrillType', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/drill-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fire Drill', description: 'Monthly fire response drill' });
    expect(res.status).toBe(201);
    drillTypeId = (res.body as { id: string }).id;
    expect(typeof drillTypeId).toBe('string');
  });

  it('lists DrillTypes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/drill-types')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const items = res.body as { id: string }[];
    expect(items.some((d) => d.id === drillTypeId)).toBe(true);
  });

  it('creates a Drill', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/drills')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId,
        drillTypeId,
        scheduledAt: new Date('2026-06-01T09:00:00Z').toISOString(),
        location: 'Muster station A',
        leadOfficer: 'Chief Officer',
      });
    expect(res.status).toBe(201);
    drillId = (res.body as { id: string }).id;
    expect((res.body as { status: string }).status).toBe('SCHEDULED');
  });

  it('adds a participant DrillRecord', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/drills/${drillId}/records`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        participantName: 'Capt. J. Smit',
        role: 'Master',
        signedAt: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    expect((res.body as { participantName: string }).participantName).toBe('Capt. J. Smit');
  });

  it('completes a Drill', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/drills/${drillId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'COMPLETED', conductedAt: new Date().toISOString(), durationMinutes: 45 });
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe('COMPLETED');
  });

  it('creates a PermitTemplate with HOT_WORK checklist', async () => {
    const items = [
      { itemId: '1', description: 'Fire watch in place', checked: false },
      { itemId: '2', description: 'Gas test completed', checked: false },
    ];
    const res = await request(app.getHttpServer())
      .post('/api/v1/permit-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        permitType: 'HOT_WORK',
        name: 'Hot Work Standard',
        checklistItemsJson: JSON.stringify(items),
      });
    expect(res.status).toBe(201);
    permitTemplateId = (res.body as { id: string }).id;
  });

  it('creates a HOT_WORK WorkPermit (REQUESTED)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/work-permits')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId,
        permitType: 'HOT_WORK',
        title: 'Welding on main engine exhaust',
        templateId: permitTemplateId,
        location: 'Engine room',
      });
    expect(res.status).toBe(201);
    hotWorkPermitId = (res.body as { id: string }).id;
    expect((res.body as { status: string }).status).toBe('REQUESTED');
  });

  it('approves the HOT_WORK permit', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/work-permits/${hotWorkPermitId}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('APPROVED');
  });

  it('blocks HOT_WORK activation without risk assessment', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/work-permits/${hotWorkPermitId}/activate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect((res.body as { message: string }).message).toMatch(/risk assessment/i);
  });

  it('adds risk assessment and activates HOT_WORK permit', async () => {
    const items = [
      { itemId: '1', description: 'Fire watch in place', checked: true },
      { itemId: '2', description: 'Gas test completed', checked: true },
    ];
    await request(app.getHttpServer())
      .patch(`/api/v1/work-permits/${hotWorkPermitId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ riskAssessmentJson: JSON.stringify(items) });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/work-permits/${hotWorkPermitId}/activate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('ACTIVE');
  });

  it('closes an ACTIVE permit and records closedAt', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/work-permits/${hotWorkPermitId}/close`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('CLOSED');
    expect((res.body as { closedAt: string | null }).closedAt).not.toBeNull();
  });

  it('creates and cancels a COLD_WORK permit', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/v1/work-permits')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, permitType: 'COLD_WORK', title: 'Pipe cleaning' });
    expect(create.status).toBe(201);
    coldWorkPermitId = (create.body as { id: string }).id;

    const cancel = await request(app.getHttpServer())
      .post(`/api/v1/work-permits/${coldWorkPermitId}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(201);
    expect((cancel.body as { status: string }).status).toBe('CANCELLED');
  });

  it('verifies RLS policies exist on safety tables', async () => {
    const tables = [
      'drill_types',
      'drills',
      'drill_records',
      'permit_templates',
      'work_permits',
      'permit_approvals',
    ];
    const result = await prisma.$queryRaw<{ tablename: string; rowsecurity: boolean }[]>`
      SELECT tablename, rowsecurity FROM pg_tables
      WHERE tablename = ANY(${tables}::text[]) AND schemaname = 'public'
    `;
    for (const row of result) {
      expect(row.rowsecurity, `RLS not enabled on ${row.tablename}`).toBe(true);
    }
  });
});
