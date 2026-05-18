import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthContext } from './auth-context';
import type { JwtPayload } from './auth.service';

/**
 * Verifies the `Authorization: Bearer <token>` header against the shore RS256
 * public key, asserts it's an access token (not refresh), and attaches the
 * resulting `AuthContext` to the request as `req.authCtx`.
 *
 * Refresh tokens are rejected here even though they verify correctly — they
 * must only be redeemed at /auth/refresh.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

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

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token is not an access token');
    }

    // Roles that aren't JWT-bound to a vessel (TENANT_ADMIN, PURCHASE_MANAGER) can
    // supply a vessel selection via X-Vessel-Id. RLS still enforces tenant isolation.
    const jwtVesselId = payload.vesselId ?? null;
    const headerVesselId =
      !jwtVesselId && req.headers['x-vessel-id'] ? (req.headers['x-vessel-id'] as string) : null;

    req.authCtx = {
      tenantId: payload.tenantId ?? null,
      vesselId: jwtVesselId ?? headerVesselId,
      userId: payload.sub,
      role: payload.role,
    };
    return true;
  }
}
