import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { and, eq, isNull } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { DrizzleService } from '../src/db/drizzle.service';
import { requisitions, stockMovements } from '../src/db/schema';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let drizzle: DrizzleService;
let token: string;
let tenantId: string;
let vesselId: string;

const ids = { componentId: '', jobId: '', partId: '', locationId: '' };
let currentRob = 20;

const storageStub = { putJobHistoryPhoto: async () => 'stub/key' };

function auth() {
  return `Bearer ${token}`;
}

async function createJobInstance(): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/job-instances')
    .set('Authorization', auth())
    .send({ componentId: ids.componentId, jobId: ids.jobId, status: 'PENDING' });
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
  drizzle = moduleRef.get(DrizzleService);

  // Tenant + vessel via API
  const tRes = await request(app.getHttpServer())
    .post('/api/v1/tenants')
    .send({
      name: 'cross-module-vessel-test',
      admin: { email: 'admin@xmod.vessel', password: 'AdminP@ss1' },
    });
  tenantId = (tRes.body as { tenant: { id: string } }).tenant.id;

  const adminLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, email: 'admin@xmod.vessel', password: 'AdminP@ss1' });
  const adminToken = (adminLogin.body as { access_token: string }).access_token;

  const vRes = await request(app.getHttpServer())
    .post('/api/v1/vessels')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'MV XMod Vessel' });
  vesselId = (vRes.body as { id: string }).id;

  await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email: 'chief@xmod.vessel', password: 'TestP@ss1', role: 'CHIEF_ENGINEER', vesselId });

  const chiefLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, email: 'chief@xmod.vessel', password: 'TestP@ss1' });
  token = (chiefLogin.body as { access_token: string }).access_token;

  // Component + Job
  const compRes = await request(app.getHttpServer())
    .post('/api/v1/components')
    .set('Authorization', auth())
    .send({ name: 'Test Engine V', sfiCode: '230.001' });
  ids.componentId = (compRes.body as { id: string }).id;

  const jobRes = await request(app.getHttpServer())
    .post('/api/v1/jobs')
    .set('Authorization', auth())
    .send({ componentId: ids.componentId, title: 'Oil change V', intervalDays: 90 });
  ids.jobId = (jobRes.body as { id: string }).id;

  // Part + Location + StockLevel (reorderPoint = 10)
  const partRes = await request(app.getHttpServer())
    .post('/api/v1/parts')
    .set('Authorization', auth())
    .send({ name: 'Engine Oil V', unit: 'L' });
  ids.partId = (partRes.body as { id: string }).id;

  const locRes = await request(app.getHttpServer())
    .post('/api/v1/stock-locations')
    .set('Authorization', auth())
    .send({ name: 'Store V' });
  ids.locationId = (locRes.body as { id: string }).id;

  await request(app.getHttpServer())
    .post('/api/v1/stock-levels')
    .set('Authorization', auth())
    .send({ partId: ids.partId, locationId: ids.locationId, minStock: '5', reorderPoint: '10' });

  // Seed RECEIPT +20
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
  await app.close();
});

describe('P1-10 cross-module — vessel', () => {
  it('sign-off with old-format partsConsumed creates no StockMovements (backward compat)', async () => {
    const instanceId = await createJobInstance();
    await request(app.getHttpServer())
      .post(`/api/v1/job-instances/${instanceId}/sign-off`)
      .set('Authorization', auth())
      .field('partsConsumedJson', JSON.stringify([{ partId: ids.partId, qty: 2, unit: 'L' }]))
      .expect(201);

    const movs = drizzle.db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.tenantId, tenantId),
          eq(stockMovements.vesselId, vesselId),
          eq(stockMovements.movementType, 'CONSUMPTION'),
          isNull(stockMovements.deletedAt),
        ),
      )
      .all();
    expect(movs.length).toBe(0); // old format skipped
  });

  it('sign-off with valid partsConsumedJson creates a CONSUMPTION movement', async () => {
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

    const movs = drizzle.db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.tenantId, tenantId),
          eq(stockMovements.vesselId, vesselId),
          eq(stockMovements.movementType, 'CONSUMPTION'),
          isNull(stockMovements.deletedAt),
        ),
      )
      .all();
    expect(movs.length).toBe(1);
    expect(parseFloat(movs[0]!.quantity)).toBe(-consumeQty);
    expect(movs[0]!.referenceType).toBe('JobHistory');
  });

  it('ROB above reorderPoint — no Requisition created', async () => {
    // After previous test ROB = 14, reorderPoint = 10 — no trigger
    const reqs = drizzle.db
      .select()
      .from(requisitions)
      .where(and(eq(requisitions.tenantId, tenantId), eq(requisitions.vesselId, vesselId)))
      .all();
    expect(reqs.length).toBe(0);
  });

  it('ROB drops to/below reorderPoint — draft Requisition auto-created', async () => {
    const instanceId = await createJobInstance();
    const consumeQty = 6; // ROB: 14 → 8, which is ≤ reorderPoint(10)
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

    const reqs = drizzle.db
      .select()
      .from(requisitions)
      .where(
        and(
          eq(requisitions.tenantId, tenantId),
          eq(requisitions.vesselId, vesselId),
          isNull(requisitions.deletedAt),
        ),
      )
      .all();
    expect(reqs.length).toBe(1);
    expect(reqs[0]!.status).toBe('DRAFT');
    expect(reqs[0]!.title).toContain('Restock');

    // Verify the ROB via API
    const rob = await request(app.getHttpServer())
      .get('/api/v1/stock-movements/rob')
      .set('Authorization', auth())
      .expect(200);
    const entry = (rob.body as Array<{ partId: string; locationId: string; rob: string }>).find(
      (r) => r.partId === ids.partId,
    );
    expect(parseFloat(entry?.rob ?? '0')).toBe(currentRob); // 8
  });
});
