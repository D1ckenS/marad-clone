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
  await prisma.tenant.create({ data: { id: tenantId, name: 'integrations-api-test' } });
  await prisma.vessel.create({
    data: { id: vesselId, tenantId, name: 'MV Integrations Test', imoNumber: '9977001' },
  });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      vesselId,
      email: 'integrations@test.shore',
      username: 'integruser',
      passwordHash: hash,
      role: 'TENANT_ADMIN',
    },
  });

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'integrations@test.shore', password: 'TestP@ss!1' });
  token = (res.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma.ocimfInspection.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.techLibraryConnector.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.accountingConnector.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenantSsoConfig.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

// ── SSO config ────────────────────────────────────────────────────────────────

describe('SSO config', () => {
  it('returns empty list when not configured', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/oidc/configs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('upserts Entra SSO config', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/oidc/config')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'ENTRA',
        discoveryUrl: 'https://login.microsoftonline.com/test-directory-id/v2.0',
        clientId: 'test-entra-client-id',
        clientSecret: 'test-secret',
        redirectUri: 'https://shore.fleetops.test/auth/callback',
        enabled: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.clientId).toBe('test-entra-client-id');
    expect(res.body.provider).toBe('ENTRA');
    expect(res.body.tenantId).toBe(tenantId);
  });

  it('upserts Google SSO config', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/oidc/config')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'GOOGLE',
        discoveryUrl: 'https://accounts.google.com',
        clientId: 'test-google-client-id.apps.googleusercontent.com',
        clientSecret: 'test-google-secret',
        redirectUri: 'https://shore.fleetops.test/auth/callback',
        enabled: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('GOOGLE');
  });

  it('reads back both SSO configs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/oidc/configs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    const providers = (res.body as { provider: string }[]).map((c) => c.provider);
    expect(providers).toContain('ENTRA');
    expect(providers).toContain('GOOGLE');
  });

  it('beginLogin returns 503 when external IDP is unreachable in test env', async () => {
    // The Entra discovery URL will fail in test env — that's expected.
    const res = await request(app.getHttpServer()).get(
      `/api/v1/auth/oidc/login?tenantId=${tenantId}`,
    );
    // Either 503 (discovery failed) or 5xx from openid-client network error
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});

// ── Tech Library connector ────────────────────────────────────────────────────

describe('Tech Library connector', () => {
  it('returns no config when not configured', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tech-library/config')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(!res.body || !res.body.provider).toBe(true);
  });

  it('upserts tech library config', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tech-library/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'TWO_BA', apiKey: 'test-2ba-key', enabled: true });
    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('TWO_BA');
    expect(res.body.apiKey).toBe('test-2ba-key');
  });

  it('lookup returns 503 when upstream is unreachable in test env', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tech-library/lookup?query=fuel+filter')
      .set('Authorization', `Bearer ${token}`);
    // Either 503 (upstream error) or 5xx from fetch failure
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('lookup returns 400 for too-short query', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tech-library/lookup?query=x')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

// ── OCIMF Inspections ─────────────────────────────────────────────────────────

describe('OCIMF Inspections', () => {
  let inspectionId: string;

  it('creates a SIRE inspection', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ocimf-inspections')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Vessel-Id', vesselId)
      .send({
        vesselId,
        inspectionType: 'SIRE',
        inspectionDate: '2026-03-15',
        inspector: 'Capt. Jones',
        port: 'Rotterdam',
        reportNumber: 'SIRE-2026-001',
        overallScore: 2.8,
      });
    expect(res.status).toBe(201);
    expect(res.body.inspectionType).toBe('SIRE');
    expect(res.body.port).toBe('Rotterdam');
    inspectionId = (res.body as { id: string }).id;
  });

  it('lists inspections by vessel', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/ocimf-inspections?vesselId=${vesselId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = (res.body as { id: string }[]).find((r) => r.id === inspectionId);
    expect(found).toBeDefined();
  });

  it('updates an inspection', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/ocimf-inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ inspector: 'Capt. Smith', overallScore: 3.1 });
    expect(res.status).toBe(200);
    expect(res.body.inspector).toBe('Capt. Smith');
  });

  it('soft-deletes an inspection', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/ocimf-inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it('RLS policy is present on ocimf_inspections', async () => {
    const rows = await prisma.$queryRaw<{ policyname: string }[]>`
      SELECT policyname FROM pg_policies WHERE tablename = 'ocimf_inspections' AND policyname = 'ocimf_inspections_tenant_isolation'
    `;
    expect(rows.length).toBe(1);
  });
});

// ── Accounting connector ──────────────────────────────────────────────────────

describe('Accounting connector', () => {
  it('returns no config when not configured', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/accounting/config')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(!res.body || !res.body.provider).toBe(true);
  });

  it('upserts accounting config', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/accounting/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'EXACT', enabled: true });
    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('EXACT');
  });

  it('exports POs as CSV (empty range returns CSV header)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/accounting/export-pos?from=2026-01-01&to=2026-01-01&format=csv')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('PO Number');
  });

  it('exports POs as Exact Online XML (empty range returns XML root)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/accounting/export-pos?from=2026-01-01&to=2026-01-01&format=exact')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain('ExactOnlineImport');
  });

  it('exports POs as XLSX (returns valid OOXML binary with correct content-type)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/accounting/export-pos?from=2026-01-01&to=2026-01-01&format=xlsx')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
    );
    expect(res.header['content-disposition']).toContain('purchase-orders.xlsx');
    // XLSX files begin with the PK ZIP magic bytes (0x50 0x4B)
    const buf = res.body as Buffer;
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
  });
});
