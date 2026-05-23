import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { DrizzleService } from '../src/db/drizzle.service';
import { outbox } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let token = '';
let drizzle: DrizzleService;
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
  drizzle = moduleRef.get(DrizzleService);

  const tenantRes = await request(app.getHttpServer())
    .post('/api/v1/tenants')
    .send({
      name: 'deferred-stubs-vessel',
      admin: { email: 'admin@stubs-vessel.test', password: 'AdminP@ss1' },
    });
  ctx.tenantId = tenantRes.body.tenant.id as string;

  const adminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
    tenantId: ctx.tenantId,
    identifier: 'admin@stubs-vessel.test',
    password: 'AdminP@ss1',
  });
  const adminToken = adminLogin.body.access_token as string;

  const vesselRes = await request(app.getHttpServer())
    .post('/api/v1/vessels')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'MV Stubs Vessel' });
  ctx.vesselId = vesselRes.body.id as string;

  await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: 'chief@stubs-vessel.test',
      password: 'TestP@ss!1',
      role: 'CHIEF_ENGINEER',
      vesselId: ctx.vesselId,
    });

  const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
    tenantId: ctx.tenantId,
    identifier: 'chief@stubs-vessel.test',
    password: 'TestP@ss!1',
  });
  token = login.body.access_token as string;
});

afterAll(async () => {
  await app.close();
});

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

async function crud(
  path: string,
  createBody: Record<string, unknown>,
  updateBody: Record<string, unknown>,
) {
  const created = await auth(request(app.getHttpServer()).post(`/api/v1/${path}`).send(createBody));
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const id = (created.body as { id: string }).id;

  const list = await auth(request(app.getHttpServer()).get(`/api/v1/${path}`));
  expect(list.status).toBe(200);
  expect((list.body as { id: string }[]).some((r) => r.id === id)).toBe(true);

  const fetched = await auth(request(app.getHttpServer()).get(`/api/v1/${path}/${id}`));
  expect(fetched.status).toBe(200);

  const patched = await auth(
    request(app.getHttpServer()).patch(`/api/v1/${path}/${id}`).send(updateBody),
  );
  expect(patched.status).toBe(200);

  const removed = await auth(request(app.getHttpServer()).delete(`/api/v1/${path}/${id}`));
  expect(removed.status).toBe(204);

  const afterDelete = await auth(request(app.getHttpServer()).get(`/api/v1/${path}/${id}`));
  expect(afterDelete.status).toBe(404);

  return id;
}

describe('Deferred-stub schemas — vessel CRUD + outbox', () => {
  it('surveys: CRUD + outbox', async () => {
    const id = await crud(
      'surveys',
      {
        vesselId: ctx.vesselId,
        scheduledAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        kind: 'Annual',
        scope: 'Hull',
        surveyor: 'DNV',
        location: 'Rotterdam',
      },
      { status: 'IN_PROGRESS', notes: 'underway' },
    );
    const rows = drizzle.db.select().from(outbox).where(eq(outbox.entityId, id)).all();
    expect(rows.length).toBeGreaterThanOrEqual(2); // upsert + delete
  });

  it('conditions-of-class: CRUD + outbox', async () => {
    const id = await crud(
      'conditions-of-class',
      {
        vesselId: ctx.vesselId,
        severity: 'CONDITION',
        title: 'Cracked plate frame 42',
        detail: 'Cracking observed in EBT',
        raisedAt: new Date().toISOString(),
        openedAt: new Date().toISOString(),
      },
      { severity: 'CLOSED', closedAt: new Date().toISOString() },
    );
    const rows = drizzle.db.select().from(outbox).where(eq(outbox.entityId, id)).all();
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('inspections: CRUD + outbox', async () => {
    const id = await crud(
      'inspections',
      {
        vesselId: ctx.vesselId,
        inspectedAt: new Date().toISOString(),
        kind: 'PSC',
        port: 'Singapore',
        inspector: 'MPA',
        deficiencies: 2,
        detained: false,
        status: 'Closed',
      },
      { deficiencies: 1, findings: 'Lifejacket light replaced' },
    );
    const rows = drizzle.db.select().from(outbox).where(eq(outbox.entityId, id)).all();
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('jhas: tenant-scoped CRUD (no outbox)', async () => {
    const id = await crud(
      'jhas',
      {
        ref: 'JHA-0001',
        title: 'Working aloft',
        hazards: ['fall', 'dropped object'],
        controls: ['harness', 'exclusion zone'],
        residualL: 2,
        residualS: 3,
      },
      { title: 'Working aloft (revised)' },
    );
    const rows = drizzle.db.select().from(outbox).where(eq(outbox.entityId, id)).all();
    expect(rows.length).toBe(0);
  });

  it('safety-equipment: CRUD + outbox', async () => {
    const id = await crud(
      'safety-equipment',
      {
        vesselId: ctx.vesselId,
        category: 'FFA',
        name: 'Foam extinguisher 9L',
        location: 'Engine room fwd',
        quantity: '4',
        status: 'GREEN',
      },
      { status: 'AMBER', flag: 'inspection due' },
    );
    const rows = drizzle.db.select().from(outbox).where(eq(outbox.entityId, id)).all();
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('qhse-objectives: tenant-scoped CRUD (no outbox)', async () => {
    const id = await crud(
      'qhse-objectives',
      {
        category: 'S',
        label: 'LTI rate',
        target: '0',
        actual: '0',
        unit: 'per 1M hours',
        status: 'GREEN',
        trend: [0, 0, 0, 0, 0],
      },
      { actual: '1', status: 'AMBER' },
    );
    const rows = drizzle.db.select().from(outbox).where(eq(outbox.entityId, id)).all();
    expect(rows.length).toBe(0);
  });

  it('audits + audit-findings: CRUD + outbox', async () => {
    const auditCreate = await auth(
      request(app.getHttpServer()).post('/api/v1/audits').send({
        vesselId: ctx.vesselId,
        kind: 'INTERNAL',
        scope: 'PMS module',
        scheduledAt: new Date().toISOString(),
        auditor: 'M. Smith',
      }),
    );
    expect(auditCreate.status).toBe(201);
    const auditId = (auditCreate.body as { id: string }).id;

    await crud(
      'audit-findings',
      {
        vesselId: ctx.vesselId,
        auditId,
        classification: 'Minor NC',
        title: 'Missing maintenance signature',
        openedAt: new Date().toISOString(),
        dueAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      },
      { closedAt: new Date().toISOString() },
    );

    const auditDelete = await auth(
      request(app.getHttpServer()).delete(`/api/v1/audits/${auditId}`),
    );
    expect(auditDelete.status).toBe(204);
  });

  it('voyage-legs: CRUD + outbox — the offline-critical one', async () => {
    const id = await crud(
      'voyage-legs',
      {
        vesselId: ctx.vesselId,
        route: 'RTM → SIN',
        departureAt: new Date().toISOString(),
        arrivalAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
        nm: '8500.50',
        fuelTonnes: '1280.000',
        co2Tonnes: '4000.000',
        soxTonnes: '12.000',
        noxTonnes: '64.000',
        hours: '480.00',
        mode: 'LADEN',
      },
      { cargo: 'Containers' },
    );
    const rows = drizzle.db.select().from(outbox).where(eq(outbox.entityId, id)).all();
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('discharge-logs: CRUD + outbox — MARPOL record book', async () => {
    const id = await crud(
      'discharge-logs',
      {
        vesselId: ctx.vesselId,
        kind: 'Garbage',
        occurredAt: new Date().toISOString(),
        location: 'Port reception facility, RTM',
        volume: '0.5 m³',
        compliant: true,
      },
      { notes: 'Receipt #12345' },
    );
    const rows = drizzle.db.select().from(outbox).where(eq(outbox.entityId, id)).all();
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('drybms-elements: tenant-scoped CRUD (no outbox)', async () => {
    const id = await crud(
      'drybms-elements',
      {
        chapter: '1',
        chapterTitle: 'Leadership',
        name: 'Senior management commitment',
        score: 3,
      },
      { score: 4, stage: 'Resilient' },
    );
    const rows = drizzle.db.select().from(outbox).where(eq(outbox.entityId, id)).all();
    expect(rows.length).toBe(0);
  });

  it('management-reviews: tenant-scoped CRUD (no outbox)', async () => {
    const id = await crud(
      'management-reviews',
      {
        kind: 'Annual',
        scheduledAt: new Date(Date.now() + 60 * 86_400_000).toISOString(),
        chair: 'CEO',
        attendees: 8,
        actionsTotal: 5,
        actionsDone: 0,
      },
      { status: 'CLOSED', actionsDone: 5, summary: 'All actions complete' },
    );
    const rows = drizzle.db.select().from(outbox).where(eq(outbox.entityId, id)).all();
    expect(rows.length).toBe(0);
  });
});
