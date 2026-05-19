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
  await prisma.tenant.create({ data: { id: tenantId, name: 'budget-api-test' } });
  await prisma.vessel.create({
    data: { id: vesselId, tenantId, name: 'MV Fleetview Test', imoNumber: '9988001' },
  });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      vesselId,
      email: 'budget@test.shore',
      username: 'budguser',
      passwordHash: hash,
      role: 'TENANT_ADMIN',
    },
  });

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'budget@test.shore', password: 'TestP@ss!1' });
  token = (res.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma.budgetLine.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.budget.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('Budget CRUD', () => {
  let budgetId: string;
  let lineId: string;

  it('creates a fleet-wide budget', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fleet 2026', year: 2026, currency: 'EUR' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Fleet 2026');
    expect(res.body.year).toBe(2026);
    expect(res.body.vesselId).toBeNull();
    budgetId = (res.body as { id: string }).id;
  });

  it('creates a vessel-scoped budget', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'MV Test 2026', year: 2026, vesselId, currency: 'EUR' });

    expect(res.status).toBe(201);
    expect(res.body.vesselId).toBe(vesselId);
  });

  it('adds a budget line', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/budgets/${budgetId}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'MAINTENANCE', budgetedAmount: '150000.00', currency: 'EUR' });

    expect(res.status).toBe(201);
    lineId = (res.body as { id: string }).id;
    expect(res.body.category).toBe('MAINTENANCE');
    // Prisma Decimal serializes without trailing zeros
    expect(parseFloat(res.body.budgetedAmount as string)).toBeCloseTo(150000, 0);
  });

  it('adds a second budget line', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/budgets/${budgetId}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'FUEL', budgetedAmount: '80000.00', currency: 'EUR', notes: 'HFO only' });

    expect(res.status).toBe(201);
    expect(res.body.category).toBe('FUEL');
  });

  it('lists budgets with lines', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/budgets?year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const fleet = (res.body as { id: string; lines: unknown[] }[]).find((b) => b.id === budgetId);
    expect(fleet).toBeDefined();
    expect(fleet!.lines.length).toBe(2);
  });

  it('updates a budget line', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/budgets/${budgetId}/lines/${lineId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ budgetedAmount: '175000.00' });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.budgetedAmount as string)).toBeCloseTo(175000, 0);
  });

  it('patches the budget name', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fleet 2026 Revised' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Fleet 2026 Revised');
  });

  it('deletes a budget line', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/budgets/${budgetId}/lines/${lineId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  it('RLS policy is present on budgets table', async () => {
    const rows = await prisma.$queryRaw<{ policyname: string }[]>`
      SELECT policyname FROM pg_policies WHERE tablename = 'budgets' AND policyname = 'budgets_tenant_isolation'
    `;
    expect(rows.length).toBe(1);
  });
});

describe('Fleetview endpoints', () => {
  it('returns fleet summary with vessel status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/fleetview/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.fleet.totalVessels).toBe('number');
    expect(Array.isArray(res.body.vessels)).toBe(true);
    const v = (res.body.vessels as { id: string }[]).find((r) => r.id === vesselId);
    expect(v).toBeDefined();
    expect((v as unknown as { status: unknown }).status).toBeDefined();
  });

  it('returns worklist items', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/fleetview/worklist?limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('returns budget-actuals for current year', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/fleetview/budget-actuals?year=2026`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.year).toBe(2026);
    expect(Array.isArray(res.body.budgets)).toBe(true);
    // The budgets we created above should appear
    expect(res.body.budgets.length).toBeGreaterThanOrEqual(1);
  });

  it('fleet summary has zero counts for this test tenant (no jobs/certs seeded)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/fleetview/summary')
      .set('Authorization', `Bearer ${token}`);

    const v = (
      res.body.vessels as { id: string; status: { overdueJobs: number; expiringCerts: number } }[]
    ).find((r) => r.id === vesselId);
    expect(v!.status.overdueJobs).toBe(0);
    expect(v!.status.expiringCerts).toBe(0);
  });

  it('summary responds in <1500 ms (P5-3 cold-path budget)', async () => {
    const t0 = Date.now();
    const res = await request(app.getHttpServer())
      .get('/api/v1/fleetview/summary')
      .set('Authorization', `Bearer ${token}`);
    const elapsed = Date.now() - t0;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(1500);
  });

  it('cached summary responds in <50 ms (P5-3 warm-path budget)', async () => {
    // First call populates cache
    await request(app.getHttpServer())
      .get('/api/v1/fleetview/summary')
      .set('Authorization', `Bearer ${token}`);

    // Second call should be served from in-process cache
    const t0 = Date.now();
    const res = await request(app.getHttpServer())
      .get('/api/v1/fleetview/summary')
      .set('Authorization', `Bearer ${token}`);
    const elapsed = Date.now() - t0;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(50);
  });

  it('RLS: summary is tenant-isolated (different tenant sees no cross-tenant vessels)', async () => {
    const otherTenantId = ulid();
    const otherUserId = ulid();
    const hash = await bcrypt.hash('Other@Pass!1', 12);
    const prisma2: PrismaService = app.get(PrismaService);

    await prisma2.tenant.create({ data: { id: otherTenantId, name: 'other-perf-test' } });
    await prisma2.user.create({
      data: {
        id: otherUserId,
        tenantId: otherTenantId,
        email: 'other@perf.test',
        username: 'otherperf',
        passwordHash: hash,
        role: 'TENANT_ADMIN',
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ tenantId: otherTenantId, identifier: 'other@perf.test', password: 'Other@Pass!1' });
    const otherToken = (loginRes.body as { access_token: string }).access_token;

    const res = await request(app.getHttpServer())
      .get('/api/v1/fleetview/summary')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.fleet.totalVessels).toBe(0);
    expect(res.body.vessels).toHaveLength(0);

    // Cleanup
    await prisma2.user.deleteMany({ where: { tenantId: otherTenantId } }).catch(() => null);
    await prisma2.tenant.deleteMany({ where: { id: otherTenantId } }).catch(() => null);
  });
});
