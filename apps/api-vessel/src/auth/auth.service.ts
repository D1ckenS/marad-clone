import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';

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
    private readonly jwt: JwtService,
  ) {}

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
   * Local-password login path retained for dev convenience. Uses a
   * vessel-local secret (HS256) that is distinct from the shore RS256
   * keypair, so neither path can spoof the other.
   *
   * In production this path will be disabled; vessel users will only
   * authenticate via shore-issued tokens delivered through sync.
   */
  async login(tenantId: string, email: string, password: string): Promise<LocalLoginResult> {
    let user;
    try {
      user = this.users.findByEmail(tenantId, email);
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
        issuer: 'marad-vessel',
      },
    );
    return { access_token };
  }
}
