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
  await prisma.tenant.create({ data: { id: tenantId, name: 'bi-api-test' } });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      email: 'bi@test.shore',
      username: 'biuser',
      passwordHash: hash,
      role: 'TENANT_ADMIN',
    },
  });

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'bi@test.shore', password: 'TestP@ss!1' });
  token = (res.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma.biDashboard.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('BI Dashboards', () => {
  let dashboardId: string;

  it('returns empty list when no dashboards configured', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/bi/dashboards')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('registers a Maintenance dashboard', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bi/dashboards')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supersetDashboardId: 'aaaaaaaa-0000-0000-0000-000000000001',
        title: 'Maintenance Overview',
        description: 'Job completion rates and overdue trends per vessel',
        category: 'Maintenance',
        sortOrder: 1,
        enabled: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Maintenance Overview');
    expect(res.body.category).toBe('Maintenance');
    dashboardId = (res.body as { id: string }).id;
  });

  it('registers a Fleet dashboard', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bi/dashboards')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supersetDashboardId: 'aaaaaaaa-0000-0000-0000-000000000002',
        title: 'Fleet Status',
        description: 'Real-time fleet KPIs and status overview',
        category: 'Fleet',
        sortOrder: 0,
        enabled: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe('Fleet');
  });

  it('lists enabled dashboards in sort order', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/bi/dashboards')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    // Fleet (sortOrder 0) should come before Maintenance (sortOrder 1)
    expect((res.body as { title: string }[])[0]!.title).toBe('Fleet Status');
  });

  it('upserts a dashboard (updates title)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bi/dashboards')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: dashboardId,
        supersetDashboardId: 'aaaaaaaa-0000-0000-0000-000000000001',
        title: 'Maintenance Analytics',
        category: 'Maintenance',
        sortOrder: 1,
        enabled: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Maintenance Analytics');
    expect(res.body.id).toBe(dashboardId);
  });

  it('guest-token returns 503 when SUPERSET_URL not set', async () => {
    // In test env SUPERSET_URL is not set — expect ServiceUnavailableException.
    const res = await request(app.getHttpServer())
      .get(`/api/v1/bi/guest-token/${dashboardId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
    expect(res.body.message).toContain('Superset is not configured');
  });

  it('GET /bi/config returns null supersetUrl when not set', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/bi/config')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.supersetUrl).toBeNull();
  });

  it('hides disabled dashboards from the public list', async () => {
    // Disable one dashboard
    await request(app.getHttpServer())
      .post('/api/v1/bi/dashboards')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: dashboardId,
        supersetDashboardId: 'aaaaaaaa-0000-0000-0000-000000000001',
        title: 'Maintenance Analytics',
        category: 'Maintenance',
        sortOrder: 1,
        enabled: false,
      });

    const res = await request(app.getHttpServer())
      .get('/api/v1/bi/dashboards')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.length).toBe(1); // only Fleet remains

    const all = await request(app.getHttpServer())
      .get('/api/v1/bi/dashboards/all')
      .set('Authorization', `Bearer ${token}`);
    expect(all.body.length).toBe(2); // both in admin view
  });

  it('deletes a dashboard', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/bi/dashboards/${dashboardId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const list = await request(app.getHttpServer())
      .get('/api/v1/bi/dashboards/all')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.length).toBe(1);
  });

  it('RLS policy is present on bi_dashboards', async () => {
    const rows = await prisma.$queryRaw<{ policyname: string }[]>`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'bi_dashboards'
        AND policyname = 'bi_dashboards_tenant_isolation'
    `;
    expect(rows.length).toBe(1);
  });
});
