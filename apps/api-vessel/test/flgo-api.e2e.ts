import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let token = '';
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
      name: 'flgo-api-vessel',
      admin: { email: 'admin@flgo-vessel.test', password: 'AdminP@ss1' },
    });
  ctx.tenantId = (tenantRes.body as { tenant: { id: string } }).tenant.id;

  const adminLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId: ctx.tenantId, email: 'admin@flgo-vessel.test', password: 'AdminP@ss1' });
  const adminToken = (adminLogin.body as { access_token: string }).access_token;

  const vesselRes = await request(app.getHttpServer())
    .post('/api/v1/vessels')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'MV FLGO Vessel' });
  ctx.vesselId = (vesselRes.body as { id: string }).id;

  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId: ctx.tenantId, email: 'admin@flgo-vessel.test', password: 'AdminP@ss1' });
  token = (login.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await app.close();
});

describe('P3-1 FLGO API — vessel', () => {
  let fuelProductId: string;
  let tankId: string;

  it('creates a FuelProduct (MGO)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/fuel-products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'MGO DMA', tankType: 'MGO', sulphurPct: '0.0010' });
    expect(res.status).toBe(201);
    fuelProductId = (res.body as { id: string }).id;
  });

  it('creates a Tank with OutboxRecorder', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tanks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId: ctx.vesselId,
        name: 'MGO Day Tank',
        tankType: 'MGO',
        fuelProductId,
        capacityM3: '25.000',
      });
    expect(res.status).toBe(201);
    tankId = (res.body as { id: string }).id;
  });

  it('tank creation writes outbox entry', async () => {
    const { DrizzleService } = await import('../src/db/drizzle.service');
    const { outbox } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const drizzle = app.get(DrizzleService);
    const entries = drizzle.db.select().from(outbox).where(eq(outbox.entityType, 'Tank')).all();
    expect(entries.length).toBeGreaterThan(0);
  });

  it('records a daily sounding', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tank-readings')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId: ctx.vesselId, tankId, readingDate: '2026-03-01', robMt: '18.400' });
    expect(res.status).toBe(201);
    expect((res.body as { readingDate: string }).readingDate).toBe('2026-03-01');
  });

  it('tank reading writes outbox entry', async () => {
    const { DrizzleService } = await import('../src/db/drizzle.service');
    const { outbox } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const drizzle = app.get(DrizzleService);
    const entries = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityType, 'TankReading'))
      .all();
    expect(entries.length).toBeGreaterThan(0);
  });

  it('records a BDN', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bunker-delivery-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId: ctx.vesselId,
        fuelProductId,
        deliveryDate: '2026-03-01',
        quantityMt: '15.000',
        sulphurPct: '0.0009',
        grade: 'DMA',
      });
    expect(res.status).toBe(201);
    expect((res.body as { deliveryDate: string }).deliveryDate).toBe('2026-03-01');
  });

  it('BDN writes outbox entry', async () => {
    const { DrizzleService } = await import('../src/db/drizzle.service');
    const { outbox } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const drizzle = app.get(DrizzleService);
    const entries = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityType, 'BunkerDeliveryNote'))
      .all();
    expect(entries.length).toBeGreaterThan(0);
  });

  it('logs consumption', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/consumption-logs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId: ctx.vesselId,
        fuelProductId,
        logDate: '2026-03-01',
        consumerType: 'MAIN_ENGINE',
        consumptionMt: '6.500',
      });
    expect(res.status).toBe(201);
    expect((res.body as { consumerType: string }).consumerType).toBe('MAIN_ENGINE');
  });

  it('consumption log writes outbox entry', async () => {
    const { DrizzleService } = await import('../src/db/drizzle.service');
    const { outbox } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const drizzle = app.get(DrizzleService);
    const entries = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityType, 'ConsumptionLog'))
      .all();
    expect(entries.length).toBeGreaterThan(0);
  });
});
