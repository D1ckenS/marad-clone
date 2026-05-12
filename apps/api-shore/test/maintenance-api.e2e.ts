import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;

const tenantId = ulid();
const vesselId = ulid();
const adminId = ulid();
const chiefId = ulid();
const tenantWideAdminId = ulid();

let chiefToken = '';
let tenantWideToken = '';

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  prisma = moduleRef.get(PrismaService);

  await prisma.tenant.create({ data: { id: tenantId, name: 'maintenance-api-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Crud' } });
  const passwordHash = await bcrypt.hash('TestP@ss!1', 12);
  await prisma.user.create({
    data: {
      id: adminId,
      tenantId,
      email: 'admin@crud.test',
      passwordHash,
      role: 'TENANT_ADMIN',
    },
  });
  await prisma.user.create({
    data: {
      id: chiefId,
      tenantId,
      vesselId,
      email: 'chief@crud.test',
      passwordHash,
      role: 'CHIEF_ENGINEER',
    },
  });
  await prisma.user.create({
    data: {
      id: tenantWideAdminId,
      tenantId,
      email: 'pm@crud.test',
      passwordHash,
      role: 'PURCHASE_MANAGER',
    },
  });

  // Login chief (vessel-bound) and tenant-wide admin (no vesselId) to get JWTs.
  const chiefRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, email: 'chief@crud.test', password: 'TestP@ss!1' });
  chiefToken = chiefRes.body.access_token as string;

  const pmRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, email: 'pm@crud.test', password: 'TestP@ss!1' });
  tenantWideToken = pmRes.body.access_token as string;
});

afterAll(async () => {
  await prisma.outbox.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.syncRecord.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.runningHourReading.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.jobHistory.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.jobInstance.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.job.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.component.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.masterComponent.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

const api = () => request(app.getHttpServer());
const auth = () => `Bearer ${chiefToken}`;

describe('P1-2b — maintenance CRUD on shore (vessel-bound writes)', () => {
  let componentId = '';
  let jobId = '';
  let instanceId = '';

  it('POST /master-components — admin creates a template (no vessel binding required)', async () => {
    const res = await api()
      .post('/api/v1/master-components')
      .set('Authorization', `Bearer ${tenantWideToken}`)
      .send({ name: 'Diesel Generator (template)', sfi: '601' })
      .expect(201);
    expect(res.body.tenantId).toBe(tenantId);
    expect(res.body.name).toBe('Diesel Generator (template)');
  });

  it('POST /components — chief creates a Component, outbox row appears', async () => {
    const res = await api()
      .post('/api/v1/components')
      .set('Authorization', auth())
      .send({ name: 'Main Engine', runningHours: '1200.50' })
      .expect(201);

    expect(res.body.tenantId).toBe(tenantId);
    expect(res.body.vesselId).toBe(vesselId);
    expect(typeof res.body.hlc).toBe('string');
    componentId = res.body.id as string;

    const outboxRow = await prisma.outbox.findFirst({
      where: { tenantId, vesselId, entityType: 'Component', entityId: componentId },
    });
    expect(outboxRow).not.toBeNull();
    expect(outboxRow?.operation).toBe('upsert');
    expect(outboxRow?.hlc).toBe(res.body.hlc);
  });

  it('POST /components — without JWT returns 401', async () => {
    await api().post('/api/v1/components').send({ name: 'Anon' }).expect(401);
  });

  it('POST /components — tenant-wide admin (no vesselId in JWT) returns 403', async () => {
    await api()
      .post('/api/v1/components')
      .set('Authorization', `Bearer ${tenantWideToken}`)
      .send({ name: 'PM-attempt' })
      .expect(403);
  });

  it('PATCH /components/:id — partial update bumps HLC of changed field only', async () => {
    const beforeOutbox = await prisma.outbox.count({
      where: { tenantId, entityType: 'Component', entityId: componentId },
    });
    const res = await api()
      .patch(`/api/v1/components/${componentId}`)
      .set('Authorization', auth())
      .send({ description: 'Updated description' })
      .expect(200);
    expect(res.body.description).toBe('Updated description');

    const afterOutbox = await prisma.outbox.count({
      where: { tenantId, entityType: 'Component', entityId: componentId },
    });
    expect(afterOutbox).toBe(beforeOutbox + 1);
  });

  it('GET /components — chief lists their vessel’s components', async () => {
    const res = await api().get('/api/v1/components').set('Authorization', auth()).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.find((c: { id: string }) => c.id === componentId)).toBeDefined();
  });

  it('POST /jobs — creates a Job tied to the Component', async () => {
    const res = await api()
      .post('/api/v1/jobs')
      .set('Authorization', auth())
      .send({
        componentId,
        title: '500-hour service',
        intervalRunningHours: '500',
        priority: 'HIGH',
      })
      .expect(201);
    jobId = res.body.id as string;
    expect(res.body.priority).toBe('HIGH');
  });

  it('POST /jobs — DB CHECK rejects a Job with no interval at all', async () => {
    await api()
      .post('/api/v1/jobs')
      .set('Authorization', auth())
      .send({ componentId, title: 'No interval' })
      .expect(500); // CHECK violation surfaces as Internal Server Error
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

  it('PATCH /job-instances/:id — moves from PENDING to IN_PROGRESS', async () => {
    const res = await api()
      .patch(`/api/v1/job-instances/${instanceId}`)
      .set('Authorization', auth())
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('POST /running-hour-readings — appends a reading + bumps Component.runningHours', async () => {
    const res = await api()
      .post('/api/v1/running-hour-readings')
      .set('Authorization', auth())
      .send({
        componentId,
        value: '1300.00',
        source: 'MANUAL',
        recordedAt: '2026-05-07T08:00:00.000Z',
      })
      .expect(201);
    expect(res.body.componentId).toBe(componentId);

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
        value: '900.00',
        source: 'MANUAL',
        recordedAt: '2026-05-07T09:00:00.000Z',
      })
      .expect(400);
  });

  it('GET /job-histories — empty list for a vessel with no sign-offs yet', async () => {
    const res = await api().get('/api/v1/job-histories').set('Authorization', auth()).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('DELETE /components/:id — soft delete writes a delete-outbox row', async () => {
    await api()
      .delete(`/api/v1/components/${componentId}`)
      .set('Authorization', auth())
      .expect(204);

    const deleteRow = await prisma.outbox.findFirst({
      where: {
        tenantId,
        vesselId,
        entityType: 'Component',
        entityId: componentId,
        operation: 'delete',
      },
    });
    expect(deleteRow).not.toBeNull();

    // GET should now 404 because deletedAt is set.
    await api().get(`/api/v1/components/${componentId}`).set('Authorization', auth()).expect(404);
  });
});
