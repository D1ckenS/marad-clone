import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ── app bootstrap ─────────────────────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;

// IDs collected during the test so afterAll can clean up.
const created = { tenantId: '', vesselId: '', userId: '' };

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  prisma = moduleRef.get(PrismaService);
});

afterAll(async () => {
  // Clean up in FK order: users → vessels → tenant.
  // The marad user is the table owner so it bypasses RLS — no withTenant needed.
  if (created.userId) await prisma.user.delete({ where: { id: created.userId } }).catch(() => null);
  if (created.vesselId)
    await prisma.vessel.delete({ where: { id: created.vesselId } }).catch(() => null);
  if (created.tenantId)
    await prisma.tenant.delete({ where: { id: created.tenantId } }).catch(() => null);
  await app.close();
});

// ── helpers ───────────────────────────────────────────────────────────────────

const api = () => request(app.getHttpServer());

// ── tests ─────────────────────────────────────────────────────────────────────

describe('P0-7 e2e — tenant → vessel → user → login', () => {
  it('POST /tenants — creates a tenant', async () => {
    const res = await api().post('/api/v1/tenants').send({ name: 'Acme Shipping' }).expect(201);

    expect(res.body).toMatchObject({ name: 'Acme Shipping' });
    expect(typeof res.body.id).toBe('string');
    created.tenantId = res.body.id as string;
  });

  it('POST /tenants/:id/vessels — creates a vessel under the tenant', async () => {
    const res = await api()
      .post(`/api/v1/tenants/${created.tenantId}/vessels`)
      .send({ name: 'MV Horizon', imoNumber: '9876543' })
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'MV Horizon',
      imoNumber: '9876543',
      tenantId: created.tenantId,
    });
    created.vesselId = res.body.id as string;
  });

  it('POST /tenants/:id/users — creates a user under the tenant', async () => {
    const res = await api()
      .post(`/api/v1/tenants/${created.tenantId}/users`)
      .send({
        email: 'chief@acme-shipping.test',
        password: 'S3cur3P@ss!',
        role: 'CHIEF_ENGINEER',
        vesselId: created.vesselId,
      })
      .expect(201);

    expect(res.body).toMatchObject({
      email: 'chief@acme-shipping.test',
      role: 'CHIEF_ENGINEER',
      tenantId: created.tenantId,
    });
    // Password hash must NOT be returned
    expect(res.body.passwordHash).toBeUndefined();
    created.userId = res.body.id as string;
  });

  it('POST /auth/login — returns a JWT for valid credentials', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({
        tenantId: created.tenantId,
        email: 'chief@acme-shipping.test',
        password: 'S3cur3P@ss!',
      })
      .expect(200);

    expect(typeof res.body.access_token).toBe('string');

    // Decode (without verify) and check payload claims.
    const [, payloadB64] = (res.body.access_token as string).split('.');
    const payload = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString());
    expect(payload.tenantId).toBe(created.tenantId);
    expect(payload.email).toBe('chief@acme-shipping.test');
    expect(payload.role).toBe('CHIEF_ENGINEER');
    expect(typeof payload.sub).toBe('string');
  });

  it('POST /auth/login — rejects wrong password', async () => {
    await api()
      .post('/api/v1/auth/login')
      .send({
        tenantId: created.tenantId,
        email: 'chief@acme-shipping.test',
        password: 'wrong-password',
      })
      .expect(401);
  });

  it('POST /auth/login — rejects unknown email', async () => {
    await api()
      .post('/api/v1/auth/login')
      .send({
        tenantId: created.tenantId,
        email: 'nobody@acme-shipping.test',
        password: 'S3cur3P@ss!',
      })
      .expect(401);
  });

  it('POST /tenants/:id/vessels — RLS: vessel belongs to correct tenant', async () => {
    const vessel = await prisma.withTenant(created.tenantId, (tx) =>
      tx.vessel.findUnique({ where: { id: created.vesselId } }),
    );
    expect(vessel).not.toBeNull();
    expect(vessel!.tenantId).toBe(created.tenantId);
  });
});
