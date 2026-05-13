import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';

let app: INestApplication;
let privateKey = '';

const tenantId = 'TEST-TENANT-RS256';
const vesselId = 'TEST-VESSEL-RS256';

beforeAll(async () => {
  // Load the same keypair the running app uses (provisioned via .env.test).
  const privPath = process.env['JWT_PRIVATE_KEY_PATH'];
  if (privPath === undefined) {
    throw new Error('JWT_PRIVATE_KEY_PATH must be set in .env.test for cross-app token tests');
  }
  privateKey = readFileSync(resolve(process.cwd(), privPath), 'utf-8');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
});

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());

function mintShoreToken(opts: {
  tenantId?: string;
  vesselId?: string;
  email?: string;
  role?: string;
  type?: 'access' | 'refresh';
  expiresIn?: string;
  issuer?: string;
  algorithm?: jwt.Algorithm;
}): string {
  return jwt.sign(
    {
      sub: 'user-id',
      tenantId: opts.tenantId ?? tenantId,
      vesselId: opts.vesselId ?? vesselId,
      email: opts.email ?? 'master@vessel.test',
      role: opts.role ?? 'MASTER',
      type: opts.type ?? 'access',
    },
    privateKey,
    {
      algorithm: opts.algorithm ?? 'RS256',
      expiresIn: opts.expiresIn ?? '24h',
      issuer: opts.issuer ?? 'fleetops-shore',
    } as jwt.SignOptions,
  );
}

describe('Vessel — verify shore-issued RS256 access token (offline)', () => {
  it('accepts a valid shore access token and returns the decoded claims', async () => {
    const token = mintShoreToken({});
    const res = await api()
      .post('/api/v1/auth/verify-shore-token')
      .send({ access_token: token })
      .expect(200);

    expect(res.body.tenantId).toBe(tenantId);
    expect(res.body.vesselId).toBe(vesselId);
    expect(res.body.email).toBe('master@vessel.test');
    expect(res.body.role).toBe('MASTER');
    expect(res.body.issuer).toBe('fleetops-shore');
    expect(typeof res.body.expiresAtUnixMs).toBe('number');
  });

  it('rejects an expired token', async () => {
    const token = mintShoreToken({ expiresIn: '-1s' });
    await api().post('/api/v1/auth/verify-shore-token').send({ access_token: token }).expect(401);
  });

  it('rejects a refresh token presented as access', async () => {
    const token = mintShoreToken({ type: 'refresh' });
    await api().post('/api/v1/auth/verify-shore-token').send({ access_token: token }).expect(401);
  });

  it('rejects a token signed with the wrong issuer', async () => {
    const token = mintShoreToken({ issuer: 'evil-shore' });
    await api().post('/api/v1/auth/verify-shore-token').send({ access_token: token }).expect(401);
  });

  it('rejects a malformed token', async () => {
    await api()
      .post('/api/v1/auth/verify-shore-token')
      .send({ access_token: 'not-a-jwt' })
      .expect(401);
  });

  it('rejects an HS256-signed token (algorithm confusion)', async () => {
    const token = jwt.sign(
      { sub: 'attacker', tenantId, type: 'access' },
      'attacker-shared-secret',
      { algorithm: 'HS256', expiresIn: '24h', issuer: 'fleetops-shore' },
    );
    await api().post('/api/v1/auth/verify-shore-token').send({ access_token: token }).expect(401);
  });
});
