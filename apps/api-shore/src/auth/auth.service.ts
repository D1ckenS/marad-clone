import { newId } from '@fleetops/domain';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditEventService } from '../audit-event/audit-event.service';
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
};

const ACCESS_TTL_MS = Number(process.env['JWT_ACCESS_TTL_MS'] ?? 24 * 60 * 60 * 1000);
const REFRESH_TTL_MS = Number(process.env['JWT_REFRESH_TTL_MS'] ?? 30 * 24 * 60 * 60 * 1000);

export type LoginResult = {
  access_token: string;
  access_expires_in_ms: number;
  refresh_token: string;
  refresh_expires_in_ms: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly audit: AuditEventService,
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
    // B7: record the refresh as part of the session lifecycle audit.
    if (user.tenantId !== null) {
      await this.recordAuthEvent(user.tenantId, user.id, 'TOKEN_REFRESH').catch(() => undefined);
    }
    return this.issueTokens(user);
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

    const access_token = this.jwt.sign(
      { ...base, type: 'access' as const },
      { expiresIn: Math.floor(ACCESS_TTL_MS / 1000), jwtid: newId() },
    );
    const refresh_token = this.jwt.sign(
      { ...base, type: 'refresh' as const },
      { expiresIn: Math.floor(REFRESH_TTL_MS / 1000), jwtid: newId() },
    );

    return {
      access_token,
      access_expires_in_ms: ACCESS_TTL_MS,
      refresh_token,
      refresh_expires_in_ms: REFRESH_TTL_MS,
    };
  }
}
