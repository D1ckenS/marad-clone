import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthContext } from './auth-context';

/** Inline role guard — pass required roles as constructor args. */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly roles: string[]) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ authCtx?: AuthContext }>();
    if (!req.authCtx || !this.roles.includes(req.authCtx.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}

/** Factory so controllers can do: @UseGuards(requireRole('SUPER_ADMIN')) */
export const requireRole = (...roles: string[]) => new RoleGuard(roles);
