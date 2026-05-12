import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './user.service';

/**
 * Tenant-scoped user CRUD. `tenantId` is read from the JWT — no path param.
 * Migrated off `/tenants/:tenantId/users` to `/users` in PR #14 (P1-2b).
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly users: UserService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateUserDto) {
    return this.users.create(auth.tenantId, dto);
  }
}
