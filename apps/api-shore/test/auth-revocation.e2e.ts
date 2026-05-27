import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * H5 e2e — refresh-token rotation, reuse detection, and the admin revoke
 * endpoint. The H5 wire-up touches AuthService.issueTokens (insert session
 * row), AuthService.refresh (rotate or reuse-detect), and the new
 * POST /auth/sessions/:userId/revoke admin route.
 */
let app: INestApplication;
let prisma: PrismaService;

const tenantId = ulid();
const vesselId = ulid();
const adminUserId = ulid();
const targetUserId = ulid();

let adminToken: string;
let adminRefresh: string;
let targetToken: string;
let targetRefresh: string;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  prisma = moduleRef.get(PrismaService);

  const adminHash = await bcrypt.hash('AdminPw!1', 12);
  const targetHash = await bcrypt.hash('TargetPw!1', 12);
  await prisma.tenant.create({ data: { id: tenantId, name: 'auth-revocation-e2e' } });
  await prisma.withTenant(tenantId, async (tx) => {
    await tx.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Revoke' } });
    await tx.user.create({
      data: {
        id: adminUserId,
        tenantId,
        vesselId,
        email: 'admin@revoke.test',
        passwordHash: adminHash,
        role: 'TENANT_ADMIN',
      },
    });
    await tx.user.create({
      data: {
        id: targetUserId,
        tenantId,
        vesselId,
        email: 'target@revoke.test',
        passwordHash: targetHash,
        role: 'CREW',
      },
    });
  });

  const adminLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'admin@revoke.test', password: 'AdminPw!1' })
    .expect(200);
  adminToken = (adminLogin.body as { access_token: string }).access_token;
  adminRefresh = (adminLogin.body as { refresh_token: string }).refresh_token;

  const targetLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'target@revoke.test', password: 'TargetPw!1' })
    .expect(200);
  targetToken = (targetLogin.body as { access_token: string }).access_token;
  targetRefresh = (targetLogin.body as { refresh_token: string }).refresh_token;
});

afterAll(async () => {
  await prisma
    .withTenant(tenantId, async (tx) => {
      await tx.auditEvent.deleteMany({ where: { tenantId } });
      await tx.user.deleteMany({ where: { tenantId } });
      await tx.vessel.deleteMany({ where: { tenantId } });
    })
    .catch(() => null);
  // refresh_token_sessions is tenant-scoped via RLS too.
  await prisma
    .$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = ''`);
      await tx.refreshTokenSession.deleteMany({
        where: { userId: { in: [adminUserId, targetUserId] } },
      });
    })
    .catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('H5 — refresh-token rotation + reuse detection', () => {
  it('login inserts a refresh_token_sessions row', async () => {
    // Login above already happened; verify the row exists.
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = ''`);
      return tx.refreshTokenSession.findMany({
        where: { userId: adminUserId, revokedAt: null },
      });
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('refresh issues a new token pair and revokes the old refresh-token row', async () => {
    const r1 = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: adminRefresh })
      .expect(200);
    const newRefresh = (r1.body as { refresh_token: string }).refresh_token;
    expect(newRefresh).not.toBe(adminRefresh);

    // Old jti's row should now have revokedAt set with reason ROTATED.
    const [, oldPayloadB64] = adminRefresh.split('.');
    const oldPayload = JSON.parse(Buffer.from(oldPayloadB64!, 'base64url').toString());
    const oldJti = oldPayload.jti as string;

    const oldRow = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = ''`);
      return tx.refreshTokenSession.findUnique({ where: { jti: oldJti } });
    });
    expect(oldRow).not.toBeNull();
    expect(oldRow!.revokedAt).not.toBeNull();
    expect(oldRow!.revokedReason).toBe('ROTATED');

    // Future refreshes should use the new token.
    adminRefresh = newRefresh;
  });

  it('reusing a rotated refresh token is detected and wholesale-revokes the user', async () => {
    // Step A: do one refresh so we have a known-rotated jti.
    const a = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: adminRefresh })
      .expect(200);
    const usedOnce = adminRefresh;
    adminRefresh = (a.body as { refresh_token: string }).refresh_token;

    // Step B: replay the rotated token. Expect 401 and a wholesale revoke.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: usedOnce })
      .expect(401);

    // The legitimate "next" refresh that the user already holds must now
    // also fail — its jti row was just stamped revoked by the reuse path.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: adminRefresh })
      .expect(401);

    // Every outstanding row for admin should now be revoked.
    const live = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = ''`);
      return tx.refreshTokenSession.findMany({
        where: { userId: adminUserId, revokedAt: null },
      });
    });
    expect(live.length).toBe(0);

    // Re-login so subsequent tests still have a valid admin token.
    const re = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ tenantId, identifier: 'admin@revoke.test', password: 'AdminPw!1' })
      .expect(200);
    adminToken = (re.body as { access_token: string }).access_token;
    adminRefresh = (re.body as { refresh_token: string }).refresh_token;
  });
});

describe('H5 — POST /auth/sessions/:userId/revoke', () => {
  it('CREW cannot revoke sessions (403)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/auth/sessions/${adminUserId}/revoke`)
      .set('Authorization', `Bearer ${targetToken}`)
      .expect(403);
  });

  it('unauthenticated returns 401', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/auth/sessions/${targetUserId}/revoke`)
      .expect(401);
  });

  it('TENANT_ADMIN revokes target user; target can no longer refresh', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/auth/sessions/${targetUserId}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((res.body as { revokedCount: number }).revokedCount).toBeGreaterThanOrEqual(1);

    // Target's refresh token is now revoked.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: targetRefresh })
      .expect(401);

    // AuditEvent recorded for the revoke.
    await new Promise((r) => setTimeout(r, 100));
    const audit = await request(app.getHttpServer())
      .get(`/api/v1/audit-events?action=SESSIONS_REVOKED&actorUserId=${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect((audit.body as unknown[]).length).toBeGreaterThan(0);
  });
});
