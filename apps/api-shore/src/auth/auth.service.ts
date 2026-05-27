import { newId } from '@fleetops/domain';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditEventService } from '../audit-event/audit-event.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';

export type JwtPayload = {
  sub: string;
  tenantId: string | null; // null for SUPER_ADMIN
  vesselId?: string;
  email: string;
  username?: string; // display name; falls back to email in the UI
  firstName?: string;
  lastName?: string;
  role: string;
  type: 'access' | 'refresh';
  jti?: string; // populated by jsonwebtoken when jwtid is set on sign()
};

// H5: 15 min default for access tokens now that refresh-token rotation
// is in place — short window contains the blast radius if an access
// token leaks. Refresh tokens stay at 30 days; rotation makes them
// individually revokable, so a leaked one becomes useless on the next
// rotate-on-use cycle (or via the admin revoke endpoint).
const ACCESS_TTL_MS = Number(process.env['JWT_ACCESS_TTL_MS'] ?? 15 * 60 * 1000);
const REFRESH_TTL_MS = Number(process.env['JWT_REFRESH_TTL_MS'] ?? 30 * 24 * 60 * 60 * 1000);

export type LoginResult = {
  access_token: string;
  access_expires_in_ms: number;
  refresh_token: string;
  refresh_expires_in_ms: number;
};

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly audit: AuditEventService,
    private readonly prisma: PrismaService,
  ) {}

  async login(tenantId: string | null, identifier: string, password: string): Promise<LoginResult> {
    let user;
    try {
      if (!tenantId) {
        // Try super-admin first, then auto-resolve tenant from identifier.
        try {
          user = await this.users.findSuperAdminByIdentifier(identifier);
          if (user.role !== 'SUPER_ADMIN') throw new Error('not a super admin');
        } catch {
          user = await this.users.findByIdentifierGlobal(identifier);
        }
      } else {
        user = await this.users.findByIdentifier(tenantId, identifier);
      }
    } catch (err) {
      // Surface the ambiguous-identifier message as-is; hide everything else.
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('multiple organisations')) throw err;
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('This account uses SSO — password login not allowed');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      // B7: record the failed attempt under the resolved tenant (if any) so
      // bruteforce + credential-stuffing patterns are visible in the trail.
      if (user.tenantId !== null) {
        await this.recordAuthEvent(user.tenantId, user.id, 'LOGIN_FAIL').catch(() => undefined);
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    // B7: record successful login. SUPER_ADMIN has tenantId=null; we skip
    // recording in that case because the AuditEvent schema requires a tenant.
    if (user.tenantId !== null) {
      await this.recordAuthEvent(user.tenantId, user.id, 'LOGIN_SUCCESS').catch(() => undefined);
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token is not a refresh token');
    }

    let user;
    try {
      if (!payload.tenantId) {
        user = await this.users.findSuperAdminByIdentifier(payload.email);
      } else {
        user = await this.users.findByIdentifier(payload.tenantId, payload.email);
      }
    } catch {
      throw new UnauthorizedException('User no longer exists');
    }

    // H5: rotate-on-use. Look up the jti's session row.
    //  - If revoked (`revoked_at` set) → reuse detected. Wholesale-revoke
    //    every outstanding row for this user and refuse the refresh. An
    //    attacker holding a stolen refresh token loses access on the next
    //    legitimate user's refresh, regardless of which side replays first.
    //  - If missing → backward-compat: token was minted before H5 landed.
    //    Allow the rotate so the new row is created (the new token enters
    //    the tracked pool).
    //  - If valid → mark revoked, mint new pair (which inserts the new
    //    row), return tokens.
    const jti = payload.jti;
    if (jti) {
      const existing = await this.withSessionTenant(user.tenantId, (tx) =>
        tx.refreshTokenSession.findUnique({ where: { jti } }),
      );
      if (existing !== null && existing.revokedAt !== null) {
        this.log.warn(
          `refresh-token reuse detected for user ${user.id} (jti=${jti}); wholesale-revoking`,
        );
        await this.revokeAllSessions(user.tenantId, user.id, 'REUSE_DETECTED').catch(
          () => undefined,
        );
        if (user.tenantId !== null) {
          await this.recordAuthEvent(user.tenantId, user.id, 'REFRESH_REUSE_DETECTED').catch(
            () => undefined,
          );
        }
        throw new UnauthorizedException(
          'Refresh token has been revoked. All sessions for this user have been terminated.',
        );
      }
      if (existing !== null && existing.revokedAt === null) {
        await this.withSessionTenant(user.tenantId, (tx) =>
          tx.refreshTokenSession.update({
            where: { jti },
            data: { revokedAt: new Date(), revokedReason: 'ROTATED' },
          }),
        );
      }
    }

    // B7: record the refresh as part of the session lifecycle audit.
    if (user.tenantId !== null) {
      await this.recordAuthEvent(user.tenantId, user.id, 'TOKEN_REFRESH').catch(() => undefined);
    }
    return this.issueTokens(user);
  }

  /**
   * H5: mark every outstanding refresh-token session for this user as
   * revoked. Called from the admin revoke endpoint and from the reuse-
   * detection path in refresh().
   */
  async revokeAllSessions(
    tenantId: string | null,
    userId: string,
    reason: string,
  ): Promise<{ revokedCount: number }> {
    const res = await this.withSessionTenant(tenantId, (tx) =>
      tx.refreshTokenSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      }),
    );
    if (tenantId !== null) {
      await this.audit
        .record({
          tenantId,
          actorUserId: userId,
          action: 'SESSIONS_REVOKED',
          entityType: 'User',
          entityId: userId,
          metadata: { reason, revokedCount: res.count },
        })
        .catch(() => undefined);
    }
    return { revokedCount: res.count };
  }

  /**
   * RLS-aware helper. Super-admin sessions live with tenantId=null and need
   * the `'' bypass` to read/write. Tenant users go through the normal
   * withTenant() path.
   */
  private withSessionTenant<T>(
    tenantId: string | null,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (tenantId !== null) return this.prisma.withTenant(tenantId, fn);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = ''`);
      return fn(tx);
    });
  }

  /**
   * Best-effort audit recorder for login/logout/refresh. Fire-and-forget at
   * the caller — failures here must never block authentication.
   */
  private recordAuthEvent(tenantId: string, userId: string, action: string) {
    return this.audit.record({
      tenantId,
      actorUserId: userId,
      action,
      entityType: 'User',
      entityId: userId,
    });
  }

  issueTokens(user: {
    id: string;
    tenantId: string | null;
    vesselId?: string | null;
    email: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    role: string;
  }): LoginResult {
    const base = {
      sub: user.id,
      tenantId: user.tenantId ?? null,
      ...(user.vesselId ? { vesselId: user.vesselId } : {}),
      email: user.email,
      ...(user.username ? { username: user.username } : {}),
      ...(user.firstName ? { firstName: user.firstName } : {}),
      ...(user.lastName ? { lastName: user.lastName } : {}),
      role: user.role,
    };

    const refreshJti = newId();
    const access_token = this.jwt.sign(
      { ...base, type: 'access' as const },
      { expiresIn: Math.floor(ACCESS_TTL_MS / 1000), jwtid: newId() },
    );
    const refresh_token = this.jwt.sign(
      { ...base, type: 'refresh' as const },
      { expiresIn: Math.floor(REFRESH_TTL_MS / 1000), jwtid: refreshJti },
    );

    // H5: track the new refresh-token session so we can revoke it later.
    // Fire-and-forget — if the insert fails (DB blip, RLS quirk for an
    // exotic role) the user still gets working tokens, they're just not
    // individually revokable until the next rotate succeeds.
    void this.withSessionTenant(user.tenantId, (tx) =>
      tx.refreshTokenSession.create({
        data: {
          jti: refreshJti,
          tenantId: user.tenantId,
          userId: user.id,
          expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        },
      }),
    ).catch((err) => {
      this.log.warn(
        `failed to insert refresh_token_session for user ${user.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });

    return {
      access_token,
      access_expires_in_ms: ACCESS_TTL_MS,
      refresh_token,
      refresh_expires_in_ms: REFRESH_TTL_MS,
    };
  }
}
