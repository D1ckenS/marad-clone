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

    req.authCtx = {
      tenantId: payload.tenantId ?? null,
      vesselId: payload.vesselId ?? null,
      userId: payload.sub,
      role: payload.role,
    };
    return true;
  }
}
