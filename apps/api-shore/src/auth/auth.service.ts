import { newId } from '@fleetops/domain';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
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
  ) {}

  async login(tenantId: string | null, identifier: string, password: string): Promise<LoginResult> {
    let user;
    try {
      if (!tenantId) {
        // No tenantId → SUPER_ADMIN login by email or username
        user = await this.users.findSuperAdminByIdentifier(identifier);
        if (user.role !== 'SUPER_ADMIN') throw new Error('Not a super admin');
      } else {
        user = await this.users.findByIdentifier(tenantId, identifier);
      }
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
    return this.issueTokens(user);
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
