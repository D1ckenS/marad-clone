import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { DrizzleService } from '../src/db/drizzle.service';
import { outbox } from '../src/db/schema';

let app: INestApplication;
let drizzle: DrizzleService;

let chiefToken = '';
let adminToken = '';
const created = { tenantId: '', vesselId: '' };

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  drizzle = moduleRef.get(DrizzleService);

  const tenantRes = await request(app.getHttpServer())
    .post('/api/v1/tenants')
    .send({
      name: 'maint-api-vessel',
      admin: { email: 'admin@vessel-crud.test', password: 'AdminP@ss1' },
    });
  created.tenantId = tenantRes.body.tenant.id as string;

  const adminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
    tenantId: created.tenantId,
    email: 'admin@vessel-crud.test',
    password: 'AdminP@ss1',
  });
  adminToken = adminLogin.body.access_token as string;

  const vesselRes = await request(app.getHttpServer())
    .post('/api/v1/vessels')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'MV Vessel-Crud' });
  created.vesselId = vesselRes.body.id as string;

  await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: 'chief@vessel-crud.test',
      password: 'TestP@ss!1',
      role: 'CHIEF_ENGINEER',
      vesselId: created.vesselId,
    });

  const chiefLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
    tenantId: created.tenantId,
    email: 'chief@vessel-crud.test',
    password: 'TestP@ss!1',
  });
  chiefToken = chiefLogin.body.access_token as string;
});

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());
const auth = () => `Bearer ${chiefToken}`;

describe('P1-2c — maintenance CRUD on vessel (vessel-bound writes)', () => {
  let componentId = '';
  let jobId = '';
  let instanceId = '';

  it('POST /components — chief creates a Component, outbox row appears', async () => {
    const res = await api()
      .post('/api/v1/components')
      .set('Authorization', auth())
      .send({ name: 'Main Engine', runningHours: '1200' })
      .expect(201);

    expect(res.body.tenantId).toBe(created.tenantId);
    expect(res.body.vesselId).toBe(created.vesselId);
    expect(typeof res.body.hlc).toBe('string');
    componentId = res.body.id as string;

    const outboxRows = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityId, componentId))
      .all();
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0]?.operation).toBe('upsert');
    expect(outboxRows[0]?.hlc).toBe(res.body.hlc);
  });

  it('POST /components — without JWT returns 401', async () => {
    await api().post('/api/v1/components').send({ name: 'Anon' }).expect(401);
  });

  it('POST /components — admin token (no vesselId in JWT) returns 403', async () => {
    await api()
      .post('/api/v1/components')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Admin attempt' })
      .expect(403);
  });

  it('PATCH /components/:id — partial update appends a fresh outbox row', async () => {
    const before = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityId, componentId))
      .all().length;
    await api()
      .patch(`/api/v1/components/${componentId}`)
      .set('Authorization', auth())
      .send({ description: 'Updated' })
      .expect(200);
    const after = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityId, componentId))
      .all().length;
    expect(after).toBe(before + 1);
  });

  it('POST /jobs — creates a Job tied to the Component', async () => {
    const res = await api()
      .post('/api/v1/jobs')
      .set('Authorization', auth())
      .send({
        componentId,
        title: 'Vessel-side service',
        intervalRunningHours: '500',
        priority: 'HIGH',
      })
      .expect(201);
    jobId = res.body.id as string;
    expect(res.body.priority).toBe('HIGH');
  });

  it('POST /jobs — DB CHECK rejects a Job with no interval', async () => {
    await api()
      .post('/api/v1/jobs')
      .set('Authorization', auth())
      .send({ componentId, title: 'No interval' })
      .expect(500);
  });

  it('POST /job-instances — schedules an occurrence', async () => {
    const res = await api()
      .post('/api/v1/job-instances')
      .set('Authorization', auth())
      .send({
        jobId,
        componentId,
        status: 'PENDING',
        dueAtRunningHours: '1700',
      })
      .expect(201);
    instanceId = res.body.id as string;
    expect(res.body.status).toBe('PENDING');
  });

  it('PATCH /job-instances/:id — moves PENDING → IN_PROGRESS', async () => {
    const res = await api()
      .patch(`/api/v1/job-instances/${instanceId}`)
      .set('Authorization', auth())
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('POST /running-hour-readings — appends a reading + bumps Component.runningHours', async () => {
    await api()
      .post('/api/v1/running-hour-readings')
      .set('Authorization', auth())
      .send({
        componentId,
        value: '1300',
        source: 'MANUAL',
        recordedAt: '2026-05-07T08:00:00.000Z',
      })
      .expect(201);

    const comp = await api()
      .get(`/api/v1/components/${componentId}`)
      .set('Authorization', auth())
      .expect(200);
    expect(comp.body.runningHours).toBe('1300');
  });

  it('POST /running-hour-readings — rejects a reading lower than current running hours', async () => {
    await api()
      .post('/api/v1/running-hour-readings')
      .set('Authorization', auth())
      .send({
        componentId,
        value: '900',
        source: 'MANUAL',
        recordedAt: '2026-05-07T09:00:00.000Z',
      })
      .expect(400);
  });

  it('GET /master-components — read-only on vessel, returns whatever sync has delivered (empty here)', async () => {
    const res = await api()
      .get('/api/v1/master-components')
      .set('Authorization', auth())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /job-histories — empty list for a vessel with no sign-offs yet', async () => {
    const res = await api().get('/api/v1/job-histories').set('Authorization', auth()).expect(200);
    expect(res.body).toHaveLength(0);
  });

  it('DELETE /components/:id — soft delete writes a delete-outbox row', async () => {
    await api()
      .delete(`/api/v1/components/${componentId}`)
      .set('Authorization', auth())
      .expect(204);

    const deleteRow = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityId, componentId))
      .all()
      .find((r) => r.operation === 'delete');
    expect(deleteRow).toBeDefined();

    await api().get(`/api/v1/components/${componentId}`).set('Authorization', auth()).expect(404);
  });
});
