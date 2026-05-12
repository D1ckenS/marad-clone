import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuthContext } from './auth-context';

type ShoreClaims = {
  sub: string;
  tenantId: string;
  vesselId?: string;
  email: string;
  role: string;
  type: string;
};

type VesselLocalClaims = {
  sub: string;
  tenantId: string;
  vesselId?: string;
  email: string;
  role: string;
  type: string;
};

/**
 * Verifies the `Authorization: Bearer <token>` header against EITHER the
 * shore RS256 public key (preferred — works offline once cached) OR the
 * vessel-local HS256 secret (legacy / dev path retained from P0-10). On
 * success, attaches `AuthContext` to `req.authCtx`.
 *
 * The two key materials are kept distinct so neither path can spoof the
 * other: shore tokens carry `iss=marad-shore`, vessel-local tokens carry
 * `iss=fleetops-vessel`. The matching key/secret only verifies the matching
 * issuer.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly publicKey: string;

  constructor() {
    const p = process.env['JWT_PUBLIC_KEY_PATH'];
    if (p === undefined || p.trim() === '') {
      throw new Error('JWT_PUBLIC_KEY_PATH is required (provision from shore via gen:jwt-keys)');
    }
    this.publicKey = readFileSync(resolve(process.cwd(), p), 'utf-8');
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      authCtx?: AuthContext;
    }>();
    const auth = req.headers['authorization'];
    if (auth === undefined || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token required');
    }
    const token = auth.slice(7);

    // 1. Shore-issued RS256.
    try {
      const payload = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: 'marad-shore',
      }) as ShoreClaims;
      if (payload.type !== 'access') {
        throw new UnauthorizedException('Token is not an access token');
      }
      req.authCtx = {
        tenantId: payload.tenantId,
        vesselId: payload.vesselId ?? null,
        userId: payload.sub,
        role: payload.role,
      };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      // fall through to vessel-local path
    }

    // 2. Vessel-local HS256.
    const localSecret =
      process.env['VESSEL_LOCAL_JWT_SECRET'] ?? 'vessel-local-dev-secret-change-me';
    try {
      const payload = jwt.verify(token, localSecret, {
        algorithms: ['HS256'],
        issuer: 'fleetops-vessel',
      }) as VesselLocalClaims;
      if (payload.type !== 'vessel-local') {
        throw new UnauthorizedException('Token is not a vessel-local access token');
      }
      req.authCtx = {
        tenantId: payload.tenantId,
        vesselId: payload.vesselId ?? null,
        userId: payload.sub,
        role: payload.role,
      };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
