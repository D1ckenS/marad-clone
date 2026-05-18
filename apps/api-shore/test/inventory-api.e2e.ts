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

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue({ putJobHistoryPhoto: async () => 'stub/key' })
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  prisma = moduleRef.get(PrismaService);

  const hash = await bcrypt.hash('TestP@ss!1', 12);
  await prisma.tenant.create({ data: { id: tenantId, name: 'inv-api-shore-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Inv Shore' } });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      vesselId,
      email: 'inv@shore.test',
      passwordHash: hash,
      role: 'CHIEF_ENGINEER',
    },
  });

  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'inv@shore.test', password: 'TestP@ss!1' });
  token = (loginRes.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma.stockMovement.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.stockLevel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.stockLocation.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.barcodeBinding.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.part.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.partCategory.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

function auth() {
  return { Authorization: `Bearer ${token}` };
}

describe('P1-6 inventory API — shore', () => {
  let catId: string;
  let partId: string;
  let locationId: string;
  let levelId: string;

  it('POST /part-categories creates a category', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/part-categories')
      .set(auth())
      .send({ name: 'Mechanical' });
    expect(res.status).toBe(201);
    catId = (res.body as { id: string }).id;
    expect(catId).toBeTruthy();
  });

  it('POST /parts creates a part linked to category', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/parts')
      .set(auth())
      .send({ name: 'Oil Filter', partNumber: 'OIL-001', unit: 'pcs', categoryId: catId });
    expect(res.status).toBe(201);
    partId = (res.body as { id: string }).id;
    expect(partId).toBeTruthy();
  });

  it('GET /parts returns the created part', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/parts').set(auth());
    expect(res.status).toBe(200);
    expect((res.body as { id: string }[]).some((p) => p.id === partId)).toBe(true);
  });

  it('POST /stock-locations creates a location', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/stock-locations')
      .set(auth())
      .send({ name: 'Engine Room Store' });
    expect(res.status).toBe(201);
    locationId = (res.body as { id: string }).id;
    expect(locationId).toBeTruthy();
  });

  it('POST /stock-levels creates a min/max config', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/stock-levels')
      .set(auth())
      .send({ partId, locationId, minStock: '2', maxStock: '20', reorderPoint: '5' });
    expect(res.status).toBe(201);
    levelId = (res.body as { id: string }).id;
    expect(levelId).toBeTruthy();
  });

  it('POST /stock-levels returns 409 on duplicate part+location', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/stock-levels')
      .set(auth())
      .send({ partId, locationId });
    expect(res.status).toBe(409);
  });

  it('POST /stock-movements RECEIPT adds stock', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/stock-movements')
      .set(auth())
      .send({
        partId,
        locationId,
        movementType: 'RECEIPT',
        quantity: '10',
        recordedAt: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
  });

  it('POST /stock-movements CONSUMPTION removes stock', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/stock-movements')
      .set(auth())
      .send({
        partId,
        locationId,
        movementType: 'CONSUMPTION',
        quantity: '-3',
        recordedAt: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
  });

  it('GET /stock-movements/rob returns ROB = 7', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/stock-movements/rob').set(auth());
    expect(res.status).toBe(200);
    const rows = res.body as { partId: string; locationId: string; rob: string }[];
    const row = rows.find((r) => r.partId === partId && r.locationId === locationId);
    expect(row).toBeDefined();
    expect(parseFloat(row!.rob)).toBeCloseTo(7, 4);
  });

  it('GET /parts/inventory-summary returns color status (rob=7, reorder=5 → green)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/parts/inventory-summary')
      .set(auth());
    expect(res.status).toBe(200);
    const summary = res.body as { id: string; stockLevels: { status: string; rob: string }[] }[];
    const p = summary.find((x) => x.id === partId);
    expect(p).toBeDefined();
    const sl = p!.stockLevels[0];
    expect(parseFloat(sl!.rob)).toBeCloseTo(7, 4);
    expect(sl!.status).toBe('green'); // 7 > reorderPoint 5
  });

  it('POST /barcode-bindings binds a barcode', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/barcode-bindings')
      .set(auth())
      .send({ partId, barcode: 'BC-SHORE-001' });
    expect(res.status).toBe(201);
  });

  it('GET /barcode-bindings/lookup/:barcode resolves part', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/barcode-bindings/lookup/BC-SHORE-001')
      .set(auth());
    expect(res.status).toBe(200);
    expect((res.body as { partId: string }).partId).toBe(partId);
  });

  it('GET /barcode-bindings/lookup/:barcode returns 404 for unknown barcode', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/barcode-bindings/lookup/NO-SUCH-BC')
      .set(auth());
    expect(res.status).toBe(404);
  });

  it('PATCH /stock-levels/:id updates reorderPoint', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/stock-levels/${levelId}`)
      .set(auth())
      .send({ reorderPoint: '8' });
    expect(res.status).toBe(200);
    expect((res.body as { reorderPoint: string }).reorderPoint).toBe('8');
  });
});
