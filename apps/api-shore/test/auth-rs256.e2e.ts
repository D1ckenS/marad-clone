import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;

const tenantId = ulid();
const vesselId = ulid();
const email = `auth-rs256-${ulid()}@example.test`;
let userId = '';
let accessToken = '';
let refreshToken = '';

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  prisma = moduleRef.get(PrismaService);

  await prisma.tenant.create({ data: { id: tenantId, name: 'rs256-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'rs256-vessel' } });
});

afterAll(async () => {
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.vessel.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
  await app.close();
});

const api = () => request(app.getHttpServer());

describe('Shore RS256 JWT — issuance, claims, refresh', () => {
  it('POST /tenants/:id/users — creates a user', async () => {
    const res = await api()
      .post(`/api/v1/tenants/${tenantId}/users`)
      .send({ email, password: 'S3cur3P@ss!', role: 'CHIEF_ENGINEER', vesselId })
      .expect(201);
    userId = res.body.id as string;
  });

  it('POST /auth/login — returns RS256 access + refresh tokens', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ tenantId, email, password: 'S3cur3P@ss!' })
      .expect(200);

    expect(typeof res.body.access_token).toBe('string');
    expect(typeof res.body.refresh_token).toBe('string');
    expect(res.body.access_expires_in_ms).toBeGreaterThan(0);
    expect(res.body.refresh_expires_in_ms).toBeGreaterThan(res.body.access_expires_in_ms);

    accessToken = res.body.access_token as string;
    refreshToken = res.body.refresh_token as string;
  });

  it('access token is RS256 with the expected claim shape', () => {
    const [headerB64] = accessToken.split('.');
    const header = JSON.parse(Buffer.from(headerB64!, 'base64url').toString());
    expect(header.alg).toBe('RS256');

    const pubPath = process.env['JWT_PUBLIC_KEY_PATH'];
    expect(pubPath).toBeDefined();
    const publicKey = readFileSync(resolve(process.cwd(), pubPath!), 'utf-8');
    const decoded = jwt.verify(accessToken, publicKey, {
      algorithms: ['RS256'],
      issuer: 'marad-shore',
    }) as Record<string, unknown>;

    expect(decoded.tenantId).toBe(tenantId);
    expect(decoded.email).toBe(email);
    expect(decoded.role).toBe('CHIEF_ENGINEER');
    expect(decoded.vesselId).toBe(vesselId);
    expect(decoded.type).toBe('access');
    expect(decoded.iss).toBe('marad-shore');
  });

  it('POST /auth/refresh — issues fresh access + rotated refresh', async () => {
    const res = await api()
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(200);
    expect(typeof res.body.access_token).toBe('string');
    expect(typeof res.body.refresh_token).toBe('string');
    expect(res.body.access_token).not.toBe(accessToken);
  });

  it('POST /auth/refresh — rejects an access token used as refresh', async () => {
    await api().post('/api/v1/auth/refresh').send({ refresh_token: accessToken }).expect(401);
  });

  it('POST /auth/refresh — rejects a malformed token', async () => {
    await api().post('/api/v1/auth/refresh').send({ refresh_token: 'not-a-jwt' }).expect(401);
  });

  it('GET /auth/oidc/login — 503 when OIDC env vars are unset (default)', async () => {
    await api().get('/api/v1/auth/oidc/login').expect(503);
  });

  it('POST /auth/oidc/callback — 503 when OIDC env vars are unset', async () => {
    await api()
      .post('/api/v1/auth/oidc/callback')
      .send({ code: 'dummy', state: 'dummy' })
      .expect(503);
  });
});
