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
  await prisma.tenant.create({ data: { id: tenantId, name: 'flgo-api-shore-test' } });
  await prisma.vessel.create({
    data: { id: vesselId, tenantId, name: 'MV FLGO Shore', imoNumber: '1234567' },
  });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      vesselId,
      email: 'flgo@shore.test',
      passwordHash: hash,
      role: 'CHIEF_ENGINEER',
    },
  });

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'flgo@shore.test', password: 'TestP@ss!1' });
  token = (res.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma.consumptionLog.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.bunkerDeliveryNote.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tankReading.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tank.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.fuelProduct.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('P3-1 FLGO API — shore', () => {
  let fuelProductId: string;
  let tankId: string;

  // ── FuelProduct ────────────────────────────────────────────────────────────

  it('creates a FuelProduct (HFO)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/fuel-products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'HFO 380 cSt', tankType: 'HFO', sulphurPct: '0.0350', densityKgM3: '991.200' });
    expect(res.status).toBe(201);
    fuelProductId = (res.body as { id: string }).id;
    expect((res.body as { tankType: string }).tankType).toBe('HFO');
  });

  // ── Tank ───────────────────────────────────────────────────────────────────

  it('creates a Tank assigned to the fuel product', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tanks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId,
        name: 'HFO Tank P',
        tankType: 'HFO',
        fuelProductId,
        capacityM3: '450.000',
        framePosition: 'FR 12–18 Port',
      });
    expect(res.status).toBe(201);
    tankId = (res.body as { id: string }).id;
    expect((res.body as { name: string }).name).toBe('HFO Tank P');
  });

  it('lists tanks filtered by vesselId', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tanks?vesselId=${vesselId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBeGreaterThan(0);
  });

  // ── TankReading (daily sounding) ───────────────────────────────────────────

  it('records a daily sounding (TankReading)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tank-readings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId,
        tankId,
        readingDate: '2026-01-15',
        robMt: '385.500',
        robM3: '388.900',
        trim: '-0.30',
      });
    expect(res.status).toBe(201);
    expect((res.body as { readingDate: string }).readingDate).toBe('2026-01-15');
  });

  it('lists tank readings in date range', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tank-readings?tankId=${tankId}&from=2026-01-01&to=2026-01-31`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBe(1);
  });

  // ── BunkerDeliveryNote ─────────────────────────────────────────────────────

  it('records a BDN with sulphur and density', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bunker-delivery-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId,
        fuelProductId,
        bdnNumber: 'BDN-2026-001',
        deliveryDate: '2026-01-10',
        port: 'Rotterdam',
        supplierName: 'Shell Bunkers',
        quantityMt: '250.000',
        densityKgM3: '989.500',
        sulphurPct: '0.0348',
        grade: 'RMG380',
      });
    expect(res.status).toBe(201);
    const _bdnId = (res.body as { id: string }).id;
    expect(typeof _bdnId).toBe('string');
    expect((res.body as { bdnNumber: string }).bdnNumber).toBe('BDN-2026-001');
  });

  // ── ConsumptionLog ─────────────────────────────────────────────────────────

  it('logs daily main engine consumption', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/consumption-logs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId,
        fuelProductId,
        logDate: '2026-01-15',
        consumerType: 'MAIN_ENGINE',
        consumptionMt: '28.500',
        voyageLeg: 'RTM-AMS',
      });
    expect(res.status).toBe(201);
    expect((res.body as { consumerType: string }).consumerType).toBe('MAIN_ENGINE');
  });

  it('logs aux engine and boiler consumption on same day', async () => {
    for (const [type, mt] of [
      ['AUX_ENGINE', '4.200'],
      ['BOILER', '1.800'],
    ]) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/consumption-logs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vesselId,
          fuelProductId,
          logDate: '2026-01-15',
          consumerType: type,
          consumptionMt: mt,
        });
      expect(res.status).toBe(201);
    }
  });

  // ── IMO DCS report ─────────────────────────────────────────────────────────

  it('GET /flgo-reports/:vesselId/imo-dcs returns valid XML', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/flgo-reports/${vesselId}/imo-dcs?year=2026`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const xml = res.text;
    expect(xml).toContain('<?xml');
    expect(xml).toContain('IMO_DCS');
    expect(xml).toContain('1234567'); // IMO number
    expect(xml).toContain('BDN-2026-001'); // BDN reference
    expect(xml).toContain('FuelConsumption');
    expect(xml).toContain('fuelType="HFO"');
  });

  it('GET /flgo-reports/:vesselId/eu-mrv returns CO2 summary with correct regulation', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/flgo-reports/${vesselId}/eu-mrv?year=2026`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = res.body as {
      regulation: string;
      totalFuelConsumptionMt: number;
      totalCo2EmissionsMt: number;
    };
    expect(body.regulation).toContain('EU MRV');
    expect(body.totalFuelConsumptionMt).toBeCloseTo(34.5, 1); // 28.5 + 4.2 + 1.8
    // HFO CO2 factor = 3.114 → 34.5 * 3.114 ≈ 107.4
    expect(body.totalCo2EmissionsMt).toBeGreaterThan(100);
  });

  it('GET /flgo-reports/:vesselId/cii returns CII with PENDING_DISTANCE_DATA', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/flgo-reports/${vesselId}/cii?year=2026`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as { ciiRating: string }).ciiRating).toBe('PENDING_DISTANCE_DATA');
    expect((res.body as { regulation: string }).regulation).toContain('CII');
  });

  it('verifies RLS policy on fuel_products', async () => {
    const rows = await prisma.$queryRaw<Array<{ policyname: string }>>`
      SELECT policyname FROM pg_policies WHERE tablename = 'fuel_products'
    `;
    expect(rows.some((r) => r.policyname === 'fuel_products_tenant_isolation')).toBe(true);
  });
});
