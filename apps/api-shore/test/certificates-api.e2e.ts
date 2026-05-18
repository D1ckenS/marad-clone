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

const storageStub = {
  putJobHistoryPhoto: async () => 'stub/key',
  put: async () => 'stub/cert-key',
};

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
  await prisma.tenant.create({ data: { id: tenantId, name: 'cert-api-shore-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Cert Shore' } });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      vesselId,
      email: 'cert@shore.test',
      passwordHash: hash,
      role: 'CHIEF_ENGINEER',
    },
  });

  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'cert@shore.test', password: 'TestP@ss!1' });
  token = (loginRes.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.certificateAttachment.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.certificate.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.certificateType.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('P2-1 certificates API — shore', () => {
  let certTypeId: string;
  let certId: string;

  it('creates a CertificateType with default alert days', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/certificate-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'STCW Basic Safety', description: 'IMO mandatory training' });
    expect(res.status).toBe(201);
    certTypeId = (res.body as { id: string }).id;
    expect(typeof certTypeId).toBe('string');
    const stored = await prisma.certificateType.findUnique({ where: { id: certTypeId } });
    expect(stored?.alertDaysJson).toBe('[90,60,30,7]');
  });

  it('lists CertificateTypes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/certificate-types')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as { id: string }[]).some((ct) => ct.id === certTypeId)).toBe(true);
  });

  it('creates a Certificate for a vessel subject', async () => {
    const expiresAt = new Date(Date.now() + 25 * 86_400_000).toISOString(); // 25 days out
    const res = await request(app.getHttpServer())
      .post('/api/v1/certificates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        certificateTypeId: certTypeId,
        subjectType: 'VESSEL',
        subjectId: vesselId,
        vesselId,
        number: 'STCW-001',
        issuedBy: 'Flag State Authority',
        expiresAt,
      });
    expect(res.status).toBe(201);
    certId = (res.body as { id: string }).id;
    expect(typeof certId).toBe('string');
  });

  it('GET /certificates returns the certificate', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/certificates?vesselId=${vesselId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as { id: string }[]).some((c) => c.id === certId)).toBe(true);
  });

  it('GET /certificates?expiringWithinDays=30 returns cert expiring in 25 days', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/certificates?expiringWithinDays=30`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as { id: string }[]).some((c) => c.id === certId)).toBe(true);
  });

  it('GET /certificates?expiringWithinDays=20 does NOT return cert expiring in 25 days', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/certificates?expiringWithinDays=20`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as { id: string }[]).some((c) => c.id === certId)).toBe(false);
  });

  it('PATCH /certificates/:id updates notes', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/certificates/${certId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Renewal in progress' });
    expect(res.status).toBe(200);
    expect((res.body as { notes: string }).notes).toBe('Renewal in progress');
  });

  it('POST /certificates/check-expiry creates an in-app Notification', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/certificates/check-expiry')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(
      (res.body as { notificationsCreated: number }).notificationsCreated,
    ).toBeGreaterThanOrEqual(1);

    const notifs = await prisma.notification.findMany({
      where: { tenantId, type: 'CERTIFICATE_EXPIRY' },
    });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(notifs[0]?.refId).toContain(certId);
  });

  it('POST /certificates/check-expiry is idempotent (no duplicate notification)', async () => {
    const before = await prisma.notification.count({
      where: { tenantId, type: 'CERTIFICATE_EXPIRY' },
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/certificates/check-expiry')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect((res.body as { notificationsCreated: number }).notificationsCreated).toBe(0);
    const after = await prisma.notification.count({
      where: { tenantId, type: 'CERTIFICATE_EXPIRY' },
    });
    expect(after).toBe(before);
  });

  it('GET /notifications returns the expiry alert', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as { type: string }[]).some((n) => n.type === 'CERTIFICATE_EXPIRY')).toBe(
      true,
    );
  });

  it('verifies RLS policy on certificate_types table', async () => {
    const policies = await prisma.$queryRaw<{ policyname: string }[]>`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'certificate_types'
        AND policyname = 'certificate_types_tenant_isolation'
    `;
    expect(policies.length).toBe(1);
  });

  it('soft-deletes a Certificate', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/certificates/${certId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
    const stored = await prisma.certificate.findUnique({ where: { id: certId } });
    expect(stored?.deletedAt).not.toBeNull();
  });
});
