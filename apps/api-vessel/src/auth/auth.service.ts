import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { newId } from '@fleetops/domain';
import { DrizzleService } from '../db/drizzle.service';
import { tenants, users, vessels } from '../db/schema';
import { UserService } from '../user/user.service';
import type { BootstrapAdminDto } from './dto/bootstrap-admin.dto';

export type ShoreJwtPayload = {
  sub: string;
  tenantId: string;
  vesselId?: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  iss?: string;
  exp?: number;
  iat?: number;
};

export type LocalLoginResult = { access_token: string };

const VESSEL_LOCAL_TTL_S = Math.floor(
  Number(process.env['VESSEL_LOCAL_JWT_TTL_MS'] ?? 8 * 60 * 60 * 1000) / 1000,
);

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly drizzle: DrizzleService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * First-launch provisioning. Creates a tenant + vessel (idempotent on id)
   * and a TENANT_ADMIN user, then issues a vessel-local JWT so the SPA can
   * proceed directly to the dashboard without a second round-trip.
   *
   * Refused unless:
   *   - VESSEL_BOOTSTRAP_KEY env var is set AND matches dto.bootstrapKey, AND
   *   - the users table is empty (cannot be used to add a second admin —
   *     for that, the existing admin must use the normal create-user flow).
   *
   * The empty-table guard mirrors shore's /auth/bootstrap-super-admin pattern.
   */
  async bootstrapAdmin(dto: BootstrapAdminDto): Promise<LocalLoginResult> {
    const expected = process.env['VESSEL_BOOTSTRAP_KEY'];
    if (expected === undefined || expected.trim() === '') {
      throw new ForbiddenException(
        'VESSEL_BOOTSTRAP_KEY not configured — set it in the desktop environment',
      );
    }
    if (dto.bootstrapKey !== expected) {
      throw new ForbiddenException('Invalid bootstrap key');
    }
    if (this.users.countAll() > 0) {
      throw new ConflictException(
        'Vessel already provisioned — log in with an existing admin to create more users',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const userId = newId();
    const vesselId = dto.vesselId ?? newId();

    // Insert tenant, vessel, and user atomically.
    this.drizzle.db.transaction((tx) => {
      tx.insert(tenants)
        .values({ id: dto.tenantId, name: dto.tenantName })
        .onConflictDoNothing({ target: tenants.id })
        .run();
      tx.insert(vessels)
        .values({
          id: vesselId,
          tenantId: dto.tenantId,
          name: dto.vesselName ?? 'Vessel',
          ...(dto.vesselImoNumber !== undefined && { imoNumber: dto.vesselImoNumber }),
        })
        .onConflictDoNothing({ target: vessels.id })
        .run();
      tx.insert(users)
        .values({
          id: userId,
          tenantId: dto.tenantId,
          vesselId,
          email: dto.email,
          passwordHash,
          role: 'TENANT_ADMIN',
        })
        .run();
    });

    return this.login(dto.email, dto.password, dto.tenantId);
  }

  /**
   * Reports whether the vessel needs first-launch provisioning. Public.
   */
  getSetupStatus(): { userCount: number; needsBootstrap: boolean; bootstrapEnabled: boolean } {
    const userCount = this.users.countAll();
    const bootstrapEnabled =
      process.env['VESSEL_BOOTSTRAP_KEY'] !== undefined &&
      process.env['VESSEL_BOOTSTRAP_KEY'].trim() !== '';
    return { userCount, needsBootstrap: userCount === 0, bootstrapEnabled };
  }

  /**
   * Verify a shore-issued RS256 access token using the cached public
   * key. No network call — this is the offline-tolerant path that
   * P0-10's verify objective requires.
   *
   * Returns the decoded payload (without `exp`/`iat`/`iss` — those are
   * gRPC-style metadata) so the caller can use claims for authorization.
   */
  async verifyShoreToken(accessToken: string): Promise<ShoreJwtPayload> {
    let payload: ShoreJwtPayload;
    try {
      payload = this.jwt.verify<ShoreJwtPayload>(accessToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired shore token');
    }
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token is not an access token');
    }
    return payload;
  }

  /**
   * Local-password login. Mirrors the shore login shape (identifier+password,
   * tenantId optional) so the same SPA login form works against either side.
   * Uses a vessel-local HS256 secret distinct from the shore RS256 keypair
   * so neither path can spoof the other.
   */
  async login(identifier: string, password: string, tenantId?: string): Promise<LocalLoginResult> {
    let user;
    try {
      user =
        tenantId !== undefined && tenantId.trim() !== ''
          ? this.users.findByEmail(tenantId, identifier)
          : this.users.findByIdentifier(identifier);
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('This account uses SSO — password login not allowed');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const localSecret =
      process.env['VESSEL_LOCAL_JWT_SECRET'] ?? 'vessel-local-dev-secret-change-me';
    const access_token = this.jwt.sign(
      {
        sub: user.id,
        tenantId: user.tenantId,
        ...(user.vesselId !== null && user.vesselId !== undefined && { vesselId: user.vesselId }),
        email: user.email,
        role: user.role,
        type: 'vessel-local',
      },
      {
        secret: localSecret,
        algorithm: 'HS256',
        expiresIn: VESSEL_LOCAL_TTL_S,
        issuer: 'fleetops-vessel',
      },
    );
    return { access_token };
  }
}
