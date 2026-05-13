import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { ulid } from 'ulidx';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let prisma: PrismaService;
let token: string;

const tenantId = ulid();
const vesselId = ulid();
const userId = ulid();

// Shared state populated during beforeAll
const ids = {
  componentId: '',
  jobId: '',
  partId: '',
  locationId: '',
};

// Sequential ROB tracking (tests run in order)
let currentRob = 20; // initial RECEIPT

const storageStub = {
  putJobHistoryPhoto: async () => 'stub/key',
};

function auth() {
  return `Bearer ${token}`;
}

async function createJobInstance(): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/job-instances')
    .set('Authorization', auth())
    .send({
      componentId: ids.componentId,
      jobId: ids.jobId,
      status: 'PENDING',
    });
  expect(res.status).toBe(201);
  return (res.body as { id: string }).id;
}

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

  const hash = await bcrypt.hash('TestP@ss1', 12);
  await prisma.tenant.create({ data: { id: tenantId, name: 'cross-module-shore-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'MV CrossMod' } });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      vesselId,
      email: 'chief@xmod.test',
      passwordHash: hash,
      role: 'CHIEF_ENGINEER',
    },
  });

  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, email: 'chief@xmod.test', password: 'TestP@ss1' });
  token = (loginRes.body as { access_token: string }).access_token;

  // Component + Job
  const compRes = await request(app.getHttpServer())
    .post('/api/v1/components')
    .set('Authorization', auth())
    .send({ name: 'Test Engine', sfiCode: '230.001' });
  ids.componentId = (compRes.body as { id: string }).id;

  const jobRes = await request(app.getHttpServer())
    .post('/api/v1/jobs')
    .set('Authorization', auth())
    .send({ componentId: ids.componentId, title: 'Oil change', intervalDays: 90 });
  ids.jobId = (jobRes.body as { id: string }).id;

  // Part + StockLocation + StockLevel (reorderPoint = 10)
  const partRes = await request(app.getHttpServer())
    .post('/api/v1/parts')
    .set('Authorization', auth())
    .send({ name: 'Engine Oil', unit: 'L' });
  ids.partId = (partRes.body as { id: string }).id;

  const locRes = await request(app.getHttpServer())
    .post('/api/v1/stock-locations')
    .set('Authorization', auth())
    .send({ name: 'Engine Room Store' });
  ids.locationId = (locRes.body as { id: string }).id;

  await request(app.getHttpServer())
    .post('/api/v1/stock-levels')
    .set('Authorization', auth())
    .send({ partId: ids.partId, locationId: ids.locationId, minStock: '5', reorderPoint: '10' });

  // Seed initial stock: RECEIPT +20 → ROB = 20
  await request(app.getHttpServer())
    .post('/api/v1/stock-movements')
    .set('Authorization', auth())
    .send({
      partId: ids.partId,
      locationId: ids.locationId,
      movementType: 'RECEIPT',
      quantity: '20',
      recordedAt: new Date().toISOString(),
    });
});

afterAll(async () => {
  await prisma.requisitionLine.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.requisition.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.stockMovement.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.stockLevel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.stockLocation.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.part.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.jobHistory.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.jobInstance.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.job.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.component.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('P1-10 cross-module — shore', () => {
  it('sign-off without partsConsumedJson creates no StockMovements', async () => {
    const instanceId = await createJobInstance();
    await request(app.getHttpServer())
      .post(`/api/v1/job-instances/${instanceId}/sign-off`)
      .set('Authorization', auth())
      .field('notes', 'No parts consumed')
      .expect(201);

    // ROB unchanged
    const rob = await request(app.getHttpServer())
      .get('/api/v1/stock-movements/rob')
      .set('Authorization', auth())
      .expect(200);
    const entry = (rob.body as Array<{ partId: string; locationId: string; rob: string }>).find(
      (r) => r.partId === ids.partId && r.locationId === ids.locationId,
    );
    expect(parseFloat(entry?.rob ?? '0')).toBe(currentRob);
  });

  it('sign-off with old-format partsConsumed creates no StockMovements (backward compat)', async () => {
    const instanceId = await createJobInstance();
    await request(app.getHttpServer())
      .post(`/api/v1/job-instances/${instanceId}/sign-off`)
      .set('Authorization', auth())
      .field('partsConsumedJson', JSON.stringify([{ partId: ids.partId, qty: 2, unit: 'L' }]))
      .expect(201);

    const rob = await request(app.getHttpServer())
      .get('/api/v1/stock-movements/rob')
      .set('Authorization', auth())
      .expect(200);
    const entry = (rob.body as Array<{ partId: string; locationId: string; rob: string }>).find(
      (r) => r.partId === ids.partId && r.locationId === ids.locationId,
    );
    expect(parseFloat(entry?.rob ?? '0')).toBe(currentRob); // unchanged — old format skipped
  });

  it('sign-off with valid partsConsumedJson creates a CONSUMPTION StockMovement', async () => {
    const instanceId = await createJobInstance();
    const consumeQty = 6;
    await request(app.getHttpServer())
      .post(`/api/v1/job-instances/${instanceId}/sign-off`)
      .set('Authorization', auth())
      .field(
        'partsConsumedJson',
        JSON.stringify([
          { partId: ids.partId, locationId: ids.locationId, quantity: String(consumeQty) },
        ]),
      )
      .expect(201);

    currentRob -= consumeQty; // 20 - 6 = 14

    const rob = await request(app.getHttpServer())
      .get('/api/v1/stock-movements/rob')
      .set('Authorization', auth())
      .expect(200);
    const entry = (rob.body as Array<{ partId: string; locationId: string; rob: string }>).find(
      (r) => r.partId === ids.partId && r.locationId === ids.locationId,
    );
    expect(parseFloat(entry?.rob ?? '0')).toBe(currentRob); // 14

    // Verify the CONSUMPTION movement itself
    const movements = await request(app.getHttpServer())
      .get(`/api/v1/stock-movements?partId=${ids.partId}`)
      .set('Authorization', auth())
      .expect(200);
    const consumption = (
      movements.body as Array<{ movementType: string; quantity: string; referenceType: string }>
    ).find((m) => m.movementType === 'CONSUMPTION');
    expect(consumption).toBeTruthy();
    expect(parseFloat(consumption!.quantity)).toBe(-consumeQty);
    expect(consumption!.referenceType).toBe('JobHistory');
  });

  it('ROB above reorderPoint — no Requisition auto-created', async () => {
    // After previous test ROB = 14, reorderPoint = 10 — no trigger
    const reqs = await request(app.getHttpServer())
      .get('/api/v1/requisitions?status=DRAFT')
      .set('Authorization', auth())
      .expect(200);
    expect((reqs.body as unknown[]).length).toBe(0);
  });

  it('ROB drops to/below reorderPoint — draft Requisition auto-created with correct line', async () => {
    const instanceId = await createJobInstance();
    const consumeQty = 6; // ROB goes 14 → 8, which is ≤ reorderPoint(10)
    await request(app.getHttpServer())
      .post(`/api/v1/job-instances/${instanceId}/sign-off`)
      .set('Authorization', auth())
      .field(
        'partsConsumedJson',
        JSON.stringify([
          { partId: ids.partId, locationId: ids.locationId, quantity: String(consumeQty) },
        ]),
      )
      .expect(201);

    currentRob -= consumeQty; // 14 - 6 = 8

    // Draft Requisition auto-created
    const reqs = await request(app.getHttpServer())
      .get('/api/v1/requisitions?status=DRAFT')
      .set('Authorization', auth())
      .expect(200);
    expect((reqs.body as unknown[]).length).toBe(1);

    const req = (
      reqs.body as Array<{ id: string; title: string; status: string; lines: unknown[] }>
    )[0]!;
    expect(req.status).toBe('DRAFT');
    expect(req.title).toContain('Restock');
    expect(req.lines).toHaveLength(1);

    const line = (req.lines as Array<{ partId: string; quantity: string }>)[0]!;
    expect(line.partId).toBe(ids.partId);
    // deficit = reorderPoint(10) - rob(8) = 2
    expect(parseFloat(line.quantity)).toBe(2);
  });
});
