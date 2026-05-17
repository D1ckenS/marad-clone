import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let chiefToken = '';
const ctx = { tenantId: '', vesselId: '' };

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue({ putJobHistoryPhoto: async () => 'stub/key', put: async () => 'stub/cert-key' })
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const tenantRes = await request(app.getHttpServer())
    .post('/api/v1/tenants')
    .send({
      name: 'cert-api-vessel',
      admin: { email: 'admin@cert-vessel.test', password: 'AdminP@ss1' },
    });
  ctx.tenantId = tenantRes.body.tenant.id as string;

  const adminLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId: ctx.tenantId, email: 'admin@cert-vessel.test', password: 'AdminP@ss1' });
  const adminToken = adminLogin.body.access_token as string;

  const vesselRes = await request(app.getHttpServer())
    .post('/api/v1/vessels')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'MV Cert Vessel' });
  ctx.vesselId = vesselRes.body.id as string;

  await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: 'chief@cert-vessel.test',
      password: 'TestP@ss!1',
      role: 'CHIEF_ENGINEER',
      vesselId: ctx.vesselId,
    });

  const chiefLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId: ctx.tenantId, email: 'chief@cert-vessel.test', password: 'TestP@ss!1' });
  chiefToken = chiefLogin.body.access_token as string;
});

afterAll(async () => {
  await app.close();
});

describe('P2-1 certificates API — vessel', () => {
  let certTypeId: string;
  let certId: string;

  it('creates a CertificateType on the vessel', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/certificate-types')
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ name: 'ISM Safety Certificate', alertDays: [90, 60, 30] });
    expect(res.status).toBe(201);
    certTypeId = (res.body as { id: string }).id;
    expect(typeof certTypeId).toBe('string');
  });

  it('lists CertificateTypes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/certificate-types')
      .set('Authorization', `Bearer ${chiefToken}`);
    expect(res.status).toBe(200);
    expect((res.body as { id: string }[]).some((ct) => ct.id === certTypeId)).toBe(true);
  });

  it('creates a Certificate for a vessel component subject', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/certificates')
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({
        certificateTypeId: certTypeId,
        subjectType: 'VESSEL',
        subjectId: ctx.vesselId,
        vesselId: ctx.vesselId,
        number: 'ISM-2026-001',
        expiresAt: new Date(Date.now() + 400 * 86_400_000).toISOString(),
        issuedBy: 'Bureau Veritas',
      });
    expect(res.status).toBe(201);
    certId = (res.body as { id: string }).id;
    expect(typeof certId).toBe('string');
  });

  it('GET /certificates returns the certificate', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/certificates?vesselId=${ctx.vesselId}`)
      .set('Authorization', `Bearer ${chiefToken}`);
    expect(res.status).toBe(200);
    expect((res.body as { id: string }[]).some((c) => c.id === certId)).toBe(true);
  });

  it('PATCH /certificates/:id updates expiresAt', async () => {
    const newExpiry = new Date(Date.now() + 500 * 86_400_000).toISOString();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/certificates/${certId}`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ expiresAt: newExpiry });
    expect(res.status).toBe(200);
    expect((res.body as { expiresAt: string }).expiresAt).toBeDefined();
  });

  it('certificate is in outbox for sync', async () => {
    const { DrizzleService } = await import('../src/db/drizzle.service');
    const { outbox } = await import('../src/db/schema');
    const drizzle = app.get(DrizzleService);
    const entries = drizzle.db
      .select()
      .from(outbox)
      .all()
      .filter((e) => e.entityType === 'Certificate' && e.entityId === certId);
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it('soft-deletes a Certificate', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/certificates/${certId}`)
      .set('Authorization', `Bearer ${chiefToken}`);
    expect(res.status).toBe(204);
  });

  it('deleted certificate not returned in list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/certificates')
      .set('Authorization', `Bearer ${chiefToken}`);
    expect(res.status).toBe(200);
    expect((res.body as { id: string }[]).some((c) => c.id === certId)).toBe(false);
  });
});
