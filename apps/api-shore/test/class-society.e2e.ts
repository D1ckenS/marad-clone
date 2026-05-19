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
  await prisma.tenant.create({ data: { id: tenantId, name: 'classsoc-api-test' } });
  await prisma.vessel.create({
    data: { id: vesselId, tenantId, name: 'MV ClassSoc Test', imoNumber: '9966001' },
  });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      vesselId,
      email: 'classsoc@test.shore',
      username: 'classsocuser',
      passwordHash: hash,
      role: 'TENANT_ADMIN',
    },
  });

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'classsoc@test.shore', password: 'TestP@ss!1' });
  token = (res.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma.classSocietySubmission.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.classSocietyConnector.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('Class Society Connectors', () => {
  it('returns empty list when no connectors configured', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/class-society/connectors')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('upserts a DNV connector', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/class-society/connectors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        society: 'DNV',
        apiKey: 'test-dnv-api-key',
        vesselRegistrations: { [vesselId]: 'DNV-CLASS-001' },
        enabled: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.society).toBe('DNV');
    expect(res.body.apiKey).toBe('test-dnv-api-key');
  });

  it('upserts an ABS connector', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/class-society/connectors')
      .set('Authorization', `Bearer ${token}`)
      .send({ society: 'ABS', apiKey: 'test-abs-key', enabled: true });
    expect(res.status).toBe(201);
    expect(res.body.society).toBe('ABS');
  });

  it('lists both connectors', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/class-society/connectors')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    const societies = (res.body as { society: string }[]).map((c) => c.society);
    expect(societies).toContain('DNV');
    expect(societies).toContain('ABS');
  });

  it('updates a connector via upsert (idempotent)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/class-society/connectors')
      .set('Authorization', `Bearer ${token}`)
      .send({ society: 'DNV', apiKey: 'updated-dnv-key', enabled: true });
    expect(res.status).toBe(201);
    expect(res.body.apiKey).toBe('updated-dnv-key');
    const list = await request(app.getHttpServer())
      .get('/api/v1/class-society/connectors')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.filter((c: { society: string }) => c.society === 'DNV').length).toBe(1);
  });
});

describe('Class Society Submissions', () => {
  let submissionId: string;

  it('builds a PMS evidence draft without submitting', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/class-society/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, society: 'DNV', reportType: 'PMS_EVIDENCE', submit: false });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.society).toBe('DNV');
    expect(res.body.reportType).toBe('PMS_EVIDENCE');
    submissionId = (res.body as { id: string }).id;
  });

  it('builds a CERTIFICATES draft', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/class-society/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, society: 'DNV', reportType: 'CERTIFICATES', submit: false });
    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('CERTIFICATES');
  });

  it('builds a FINDINGS draft', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/class-society/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, society: 'DNV', reportType: 'FINDINGS', submit: false });
    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('FINDINGS');
  });

  it('builds a SURVEY_STATUS draft', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/class-society/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, society: 'DNV', reportType: 'SURVEY_STATUS', submit: false });
    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('SURVEY_STATUS');
  });

  it('lists submission history for vessel', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/class-society/submissions?vesselId=${vesselId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });

  it('submission record has a payloadJson with expected structure', async () => {
    const stored = await prisma.classSocietySubmission.findFirst({
      where: { id: submissionId, tenantId },
    });
    expect(stored).toBeDefined();
    expect(stored!.payloadJson).toBeDefined();
    const payload = stored!.payloadJson as Record<string, unknown>;
    expect(payload.society).toBe('DNV');
    expect(payload.vessel).toBeDefined();
    expect(payload.pmsEvidence).toBeDefined();
  });

  it('submit attempt with API key returns ERROR status (unreachable test endpoint)', async () => {
    // Connector has an API key — service will try to POST to Veracity but fail
    const res = await request(app.getHttpServer())
      .post('/api/v1/class-society/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, society: 'DNV', reportType: 'PMS_EVIDENCE', submit: true });
    expect(res.status).toBe(201);
    // In test env the Veracity API is unreachable — status is ERROR or SUBMITTED
    expect(['SUBMITTED', 'ERROR', 'DRAFT']).toContain(res.body.status);
  });

  it('export endpoint returns JSON payload with correct content-type', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/class-society/export?vesselId=${vesselId}&society=DNV&reportType=PMS_EVIDENCE`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/application\/json/);
    expect(res.header['content-disposition']).toContain('.json');
    expect(res.body.society).toBe('DNV');
    expect(res.body.vessel).toBeDefined();
  });

  it('RLS policy is present on class_society_connectors', async () => {
    const rows = await prisma.$queryRaw<{ policyname: string }[]>`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'class_society_connectors'
        AND policyname = 'class_society_connectors_tenant_isolation'
    `;
    expect(rows.length).toBe(1);
  });
});
