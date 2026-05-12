import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;

// Captured during setup so afterAll can clean up.
const created = { tenantId: '', adminUserId: '', vesselId: '', chiefUserId: '' };
let adminToken = '';
let chiefToken = '';

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
  if (created.chiefUserId)
    await prisma.user.delete({ where: { id: created.chiefUserId } }).catch(() => null);
  if (created.adminUserId)
    await prisma.user.delete({ where: { id: created.adminUserId } }).catch(() => null);
  if (created.vesselId)
    await prisma.vessel.delete({ where: { id: created.vesselId } }).catch(() => null);
  if (created.tenantId)
    await prisma.tenant.delete({ where: { id: created.tenantId } }).catch(() => null);
  await app.close();
});

const api = () => request(app.getHttpServer());

describe('P0-7 + P1-2b e2e — bootstrap → JWT → CRUD', () => {
  it('POST /tenants — bootstraps tenant + initial TENANT_ADMIN', async () => {
    const res = await api()
      .post('/api/v1/tenants')
      .send({
        name: 'Acme Shipping',
        admin: { email: 'admin@acme-shipping.test', password: 'AdminP@ss1' },
      })
      .expect(201);

    expect(res.body.tenant.name).toBe('Acme Shipping');
    expect(res.body.admin.email).toBe('admin@acme-shipping.test');
    expect(res.body.admin.role).toBe('TENANT_ADMIN');
    expect(res.body.admin.passwordHash).toBeUndefined();

    created.tenantId = res.body.tenant.id as string;
    created.adminUserId = res.body.admin.id as string;
  });

  it('POST /auth/login — admin can log in and receives RS256 tokens', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({
        tenantId: created.tenantId,
        email: 'admin@acme-shipping.test',
        password: 'AdminP@ss1',
      })
      .expect(200);

    expect(typeof res.body.access_token).toBe('string');
    adminToken = res.body.access_token as string;
  });

  it('POST /vessels — admin creates a vessel using JWT', async () => {
    const res = await api()
      .post('/api/v1/vessels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'MV Horizon', imoNumber: '9876543' })
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'MV Horizon',
      imoNumber: '9876543',
      tenantId: created.tenantId,
    });
    created.vesselId = res.body.id as string;
  });

  it('POST /vessels — without JWT returns 401', async () => {
    await api().post('/api/v1/vessels').send({ name: 'No Auth' }).expect(401);
  });

  it('POST /users — admin creates a CHIEF_ENGINEER bound to the vessel', async () => {
    const res = await api()
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
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
    expect(res.body.passwordHash).toBeUndefined();
    created.chiefUserId = res.body.id as string;
  });

  it('POST /users — without JWT returns 401', async () => {
    await api().post('/api/v1/users').send({ email: 'x@y.z', password: 'p' }).expect(401);
  });

  it('POST /auth/login — chief engineer can log in', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({
        tenantId: created.tenantId,
        email: 'chief@acme-shipping.test',
        password: 'S3cur3P@ss!',
      })
      .expect(200);

    chiefToken = res.body.access_token as string;
    const [, payloadB64] = chiefToken.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString());
    expect(payload.tenantId).toBe(created.tenantId);
    expect(payload.email).toBe('chief@acme-shipping.test');
    expect(payload.role).toBe('CHIEF_ENGINEER');
    expect(payload.vesselId).toBe(created.vesselId);
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

  it('GET /vessels — chief can list vessels in their own tenant', async () => {
    const res = await api()
      .get('/api/v1/vessels')
      .set('Authorization', `Bearer ${chiefToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: created.vesselId, tenantId: created.tenantId });
  });

  it('POST /vessels — refresh token presented as access is rejected', async () => {
    const refreshRes = await api()
      .post('/api/v1/auth/login')
      .send({
        tenantId: created.tenantId,
        email: 'admin@acme-shipping.test',
        password: 'AdminP@ss1',
      })
      .expect(200);
    const refresh = refreshRes.body.refresh_token as string;
    await api()
      .post('/api/v1/vessels')
      .set('Authorization', `Bearer ${refresh}`)
      .send({ name: 'Hijacked' })
      .expect(401);
  });

  it('GET /tenants/self — returns the JWT holder’s tenant', async () => {
    const res = await api()
      .get('/api/v1/tenants/self')
      .set('Authorization', `Bearer ${chiefToken}`)
      .expect(200);
    expect(res.body.id).toBe(created.tenantId);
  });
});
