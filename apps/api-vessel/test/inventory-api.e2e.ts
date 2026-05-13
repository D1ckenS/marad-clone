import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let chiefToken = '';
const created = { tenantId: '', vesselId: '' };

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue({ putJobHistoryPhoto: async () => 'stub/key' })
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const tenantRes = await request(app.getHttpServer())
    .post('/api/v1/tenants')
    .send({
      name: 'inv-api-vessel',
      admin: { email: 'admin@inv-vessel.test', password: 'AdminP@ss1' },
    });
  created.tenantId = tenantRes.body.tenant.id as string;

  const adminLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId: created.tenantId, email: 'admin@inv-vessel.test', password: 'AdminP@ss1' });
  const adminToken = adminLogin.body.access_token as string;

  const vesselRes = await request(app.getHttpServer())
    .post('/api/v1/vessels')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'MV Inv Vessel' });
  created.vesselId = vesselRes.body.id as string;

  await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: 'chief@inv-vessel.test',
      password: 'TestP@ss!1',
      role: 'CHIEF_ENGINEER',
      vesselId: created.vesselId,
    });

  const chiefLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId: created.tenantId, email: 'chief@inv-vessel.test', password: 'TestP@ss!1' });
  chiefToken = chiefLogin.body.access_token as string;
});

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());
const auth = () => `Bearer ${chiefToken}`;

describe('P1-6 inventory API — vessel', () => {
  let catId: string;
  let partId: string;
  let locationId: string;
  let levelId: string;

  it('POST /part-categories creates a category', async () => {
    const res = await api()
      .post('/api/v1/part-categories')
      .set('Authorization', auth())
      .send({ name: 'Filters' });
    expect(res.status).toBe(201);
    catId = res.body.id as string;
    expect(catId).toBeTruthy();
  });

  it('POST /parts creates a part', async () => {
    const res = await api()
      .post('/api/v1/parts')
      .set('Authorization', auth())
      .send({ name: 'Lube Oil', partNumber: 'LUBE-001', unit: 'L', categoryId: catId });
    expect(res.status).toBe(201);
    partId = res.body.id as string;
    expect(partId).toBeTruthy();
  });

  it('GET /parts lists the part', async () => {
    const res = await api().get('/api/v1/parts').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect((res.body as { id: string }[]).some((p) => p.id === partId)).toBe(true);
  });

  it('POST /stock-locations creates a location', async () => {
    const res = await api()
      .post('/api/v1/stock-locations')
      .set('Authorization', auth())
      .send({ name: 'Lube Store' });
    expect(res.status).toBe(201);
    locationId = res.body.id as string;
    expect(locationId).toBeTruthy();
  });

  it('POST /stock-levels creates a config', async () => {
    const res = await api()
      .post('/api/v1/stock-levels')
      .set('Authorization', auth())
      .send({ partId, locationId, minStock: '5', maxStock: '100', reorderPoint: '20' });
    expect(res.status).toBe(201);
    levelId = res.body.id as string;
    expect(levelId).toBeTruthy();
  });

  it('POST /stock-levels returns 409 on duplicate', async () => {
    const res = await api()
      .post('/api/v1/stock-levels')
      .set('Authorization', auth())
      .send({ partId, locationId });
    expect(res.status).toBe(409);
  });

  it('POST /stock-movements RECEIPT adds stock', async () => {
    const res = await api().post('/api/v1/stock-movements').set('Authorization', auth()).send({
      partId,
      locationId,
      movementType: 'RECEIPT',
      quantity: '50',
      recordedAt: new Date().toISOString(),
    });
    expect(res.status).toBe(201);
  });

  it('POST /stock-movements CONSUMPTION removes stock', async () => {
    const res = await api().post('/api/v1/stock-movements').set('Authorization', auth()).send({
      partId,
      locationId,
      movementType: 'CONSUMPTION',
      quantity: '-12',
      recordedAt: new Date().toISOString(),
    });
    expect(res.status).toBe(201);
  });

  it('GET /stock-movements/rob returns ROB = 38', async () => {
    const res = await api().get('/api/v1/stock-movements/rob').set('Authorization', auth());
    expect(res.status).toBe(200);
    const rows = res.body as { partId: string; locationId: string; rob: string }[];
    const row = rows.find((r) => r.partId === partId && r.locationId === locationId);
    expect(row).toBeDefined();
    expect(parseFloat(row!.rob)).toBeCloseTo(38, 4);
  });

  it('GET /parts/inventory-summary returns green status (rob=38, reorder=20)', async () => {
    const res = await api().get('/api/v1/parts/inventory-summary').set('Authorization', auth());
    expect(res.status).toBe(200);
    const summary = res.body as { id: string; stockLevels: { status: string; rob: string }[] }[];
    const p = summary.find((x) => x.id === partId);
    expect(p).toBeDefined();
    const sl = p!.stockLevels[0];
    expect(parseFloat(sl!.rob)).toBeCloseTo(38, 4);
    expect(sl!.status).toBe('green');
  });

  it('POST /barcode-bindings + GET lookup works', async () => {
    await api()
      .post('/api/v1/barcode-bindings')
      .set('Authorization', auth())
      .send({ partId, barcode: 'VES-BC-INV-001' });
    const res = await api()
      .get('/api/v1/barcode-bindings/lookup/VES-BC-INV-001')
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect((res.body as { partId: string }).partId).toBe(partId);
  });

  it('PATCH /stock-levels/:id updates minStock', async () => {
    const res = await api()
      .patch(`/api/v1/stock-levels/${levelId}`)
      .set('Authorization', auth())
      .send({ minStock: '10' });
    expect(res.status).toBe(200);
    expect((res.body as { minStock: string }).minStock).toBe('10');
  });
});
