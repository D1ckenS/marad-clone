import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { DrizzleService } from '../src/db/drizzle.service';
import { jobHistories, outbox } from '../src/db/schema';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let drizzle: DrizzleService;

let chiefToken = '';
let adminToken = '';
const created = { tenantId: '', vesselId: '' };

const uploadedPhotos: Array<{ originalname: string; size: number }> = [];
const storageStub = {
  putJobHistoryPhoto: vi.fn(async (ctx, idx, file) => {
    uploadedPhotos.push({ originalname: file.originalname, size: file.buffer.length });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    return `${ctx.tenantId}/${ctx.vesselId}/job-history/${ctx.jobHistoryId}/photos/${idx}-${safeName}`;
  }),
};

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue(storageStub)
    .compile();
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

  it('POST /job-instances/:id/sign-off — creates JobHistory + flips instance to DONE', async () => {
    const res = await api()
      .post(`/api/v1/job-instances/${instanceId}/sign-off`)
      .set('Authorization', auth())
      .field('hoursWorked', '3.0')
      .field('notes', 'Cleaned strainer')
      .field('signatureHash', 'sha256:vessel-test')
      .field('partsConsumedJson', JSON.stringify([{ partId: 'p-vessel-1', qty: 2 }]))
      .attach('photos', Buffer.from('vessel-jpeg-bytes-1'), 'before.jpg')
      .attach('photos', Buffer.from('vessel-jpeg-bytes-2'), 'after.jpg')
      .expect(201);

    expect(res.body.jobInstanceId).toBe(instanceId);
    expect(res.body.photos).toHaveLength(2);
    expect(res.body.photos[0]).toContain(`${created.tenantId}/${created.vesselId}/job-history/`);
    expect(res.body.partsConsumed).toEqual([{ partId: 'p-vessel-1', qty: 2 }]);

    expect(storageStub.putJobHistoryPhoto).toHaveBeenCalledTimes(2);
    expect(uploadedPhotos.map((p) => p.originalname)).toEqual(['before.jpg', 'after.jpg']);

    const inst = await api()
      .get(`/api/v1/job-instances/${instanceId}`)
      .set('Authorization', auth())
      .expect(200);
    expect(inst.body.status).toBe('DONE');
  });

  it('GET /job-histories — list now returns the signed-off record (photos parsed)', async () => {
    const res = await api().get('/api/v1/job-histories').set('Authorization', auth()).expect(200);
    expect(res.body).toHaveLength(1);
    expect(Array.isArray(res.body[0].photos)).toBe(true);
    expect(res.body[0].notes).toBe('Cleaned strainer');
  });

  it('POST /job-instances/:id/sign-off — second sign-off on a DONE instance returns 409', async () => {
    await api()
      .post(`/api/v1/job-instances/${instanceId}/sign-off`)
      .set('Authorization', auth())
      .field('notes', 'Tampering attempt')
      .expect(409);
  });

  it('POST /job-instances/:id/sign-off — without JWT returns 401', async () => {
    await api()
      .post(`/api/v1/job-instances/${instanceId}/sign-off`)
      .field('notes', 'Anon')
      .expect(401);
  });

  it('JobHistory immutability trigger blocks direct UPDATE of business columns', () => {
    const row = drizzle.db
      .select()
      .from(jobHistories)
      .where(eq(jobHistories.jobInstanceId, instanceId))
      .get();
    expect(row).toBeDefined();
    expect(() =>
      drizzle.db
        .update(jobHistories)
        .set({ notes: 'rewritten' })
        .where(eq(jobHistories.id, row!.id))
        .run(),
    ).toThrow(/immutable/);
  });

  it('POST /running-hour-readings — auto-schedules a JobInstance when crossing RH boundary', async () => {
    // Component is at 1300h; job intervalRunningHours = 500.
    // floor(1300/500) = 2 → next threshold at 3×500 = 1500.
    await api()
      .post('/api/v1/running-hour-readings')
      .set('Authorization', auth())
      .send({
        componentId,
        value: '1800.00',
        source: 'MANUAL',
        recordedAt: '2026-05-07T10:00:00.000Z',
      })
      .expect(201);

    const res = await api().get('/api/v1/job-instances').set('Authorization', auth()).expect(200);
    const autoInst = (
      res.body as Array<{ jobId: string; dueAtRunningHours: string; status: string }>
    ).find((i) => i.jobId === jobId && i.dueAtRunningHours === '1500');
    expect(autoInst).toBeDefined();
    expect(autoInst?.status).toBe('PENDING');
  });

  it('POST /running-hour-readings — idempotent: no duplicate instance at same threshold', async () => {
    // floor(1900/500) = 3 = floor(1800/500) → no new threshold crossed.
    await api()
      .post('/api/v1/running-hour-readings')
      .set('Authorization', auth())
      .send({
        componentId,
        value: '1900.00',
        source: 'MANUAL',
        recordedAt: '2026-05-07T11:00:00.000Z',
      })
      .expect(201);

    const res = await api().get('/api/v1/job-instances').set('Authorization', auth()).expect(200);
    const at1500 = (res.body as Array<{ jobId: string; dueAtRunningHours: string }>).filter(
      (i) => i.jobId === jobId && i.dueAtRunningHours === '1500',
    );
    expect(at1500).toHaveLength(1);
  });

  it('POST /running-hour-readings — crossing next boundary opens second auto-instance', async () => {
    // Component at 1900; reading of 2001 → floor(2001/500)=4, triggers at 2000.
    await api()
      .post('/api/v1/running-hour-readings')
      .set('Authorization', auth())
      .send({
        componentId,
        value: '2001.00',
        source: 'MANUAL',
        recordedAt: '2026-05-07T12:00:00.000Z',
      })
      .expect(201);

    const res = await api().get('/api/v1/job-instances').set('Authorization', auth()).expect(200);
    const at2000 = (
      res.body as Array<{ jobId: string; dueAtRunningHours: string; status: string }>
    ).find((i) => i.jobId === jobId && i.dueAtRunningHours === '2000');
    expect(at2000).toBeDefined();
    expect(at2000?.status).toBe('PENDING');
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
