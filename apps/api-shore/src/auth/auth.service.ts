import { newId } from '@marad-clone/domain';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';

/**
 * Access-token claim set. RS256-signed by shore.
 *
 * `vesselId` is optional — populated when the user is bound to a single
 * vessel, omitted for tenant-wide roles like TENANT_ADMIN.
 */
export type JwtPayload = {
  sub: string; // user id
  tenantId: string;
  vesselId?: string;
  email: string;
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
  ) {}

  async login(tenantId: string, email: string, password: string): Promise<LoginResult> {
    let user;
    try {
      user = await this.users.findByEmail(tenantId, email);
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('This account uses SSO — password login not allowed');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user);
  }

  /**
   * Validate a refresh token and mint a fresh access + refresh pair.
   * Refresh tokens rotate — the caller should discard the old one.
   */
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
      user = await this.users.findByEmail(payload.tenantId, payload.email);
    } catch {
      throw new UnauthorizedException('User no longer exists');
    }
    return this.issueTokens(user);
  }

  private issueTokens(user: {
    id: string;
    tenantId: string;
    vesselId?: string | null;
    email: string;
    role: string;
  }): LoginResult {
    const base = {
      sub: user.id,
      tenantId: user.tenantId,
      ...(user.vesselId !== null && user.vesselId !== undefined && { vesselId: user.vesselId }),
      email: user.email,
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
