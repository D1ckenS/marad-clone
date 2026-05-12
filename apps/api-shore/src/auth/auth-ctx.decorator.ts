import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { AuthContext } from './auth-context';

/**
 * Param decorator that returns the `AuthContext` attached by `JwtAuthGuard`.
 * Throws if used on a route that isn't guarded — protects against silently
 * shipping an unauthenticated controller.
 */
export const AuthCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest<{ authCtx?: AuthContext }>();
    if (req.authCtx === undefined) {
      throw new InternalServerErrorException(
        '@AuthCtx used without JwtAuthGuard — apply @UseGuards(JwtAuthGuard) on the route',
      );
    }
    return req.authCtx;
  },
);
