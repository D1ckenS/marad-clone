import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { requireRole } from '../auth/role.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantService } from './tenant.service';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';

@Controller('tenants')
export class TenantController {
  constructor(
    private readonly tenants: TenantService,
    private readonly users: UserService,
  ) {}

  /**
   * SUPER_ADMIN: create a new tenant with its initial TENANT_ADMIN user.
   *
   * Was previously unauthenticated (B3): anyone reaching the shore API could
   * create tenants + admins, opening a DoS-via-storage and trivial-account-
   * creation attack. First-tenant bootstrap now happens via POST
   * `/auth/bootstrap-super-admin` (key-gated) → log in as SUPER_ADMIN → call
   * this endpoint.
   */
  @Post()
  @UseGuards(JwtAuthGuard, requireRole('SUPER_ADMIN'))
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  /** SUPER_ADMIN: list all tenants with vessel + user counts. */
  @Get()
  @UseGuards(JwtAuthGuard, requireRole('SUPER_ADMIN'))
  findAll() {
    return this.tenants.findAll();
  }

  /** Self-lookup: returns the tenant the JWT belongs to. */
  @Get('self')
  @UseGuards(JwtAuthGuard)
  self(@AuthCtx() auth: AuthContext) {
    return this.tenants.findById(auth.tenantId!);
  }

  /** SUPER_ADMIN: update company name and/or short name. */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, requireRole('SUPER_ADMIN'))
  update(@Param('id') id: string, @Body() dto: { name?: string; shortName?: string | null }) {
    return this.tenants.update(id, dto);
  }

  /** SUPER_ADMIN: create a user (typically TENANT_ADMIN) inside a specific company. */
  @Post(':id/users')
  @UseGuards(JwtAuthGuard, requireRole('SUPER_ADMIN'))
  createUserForTenant(@Param('id') tenantId: string, @Body() dto: CreateUserDto) {
    return this.users.create(tenantId, dto);
  }
}
