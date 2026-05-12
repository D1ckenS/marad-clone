import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantService } from './tenant.service';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  /**
   * Bootstrap a tenant + initial TENANT_ADMIN. Open endpoint: every other
   * route requires a JWT, so something has to mint the first credentials.
   * In production this should be locked behind a platform-admin token —
   * tracked as a follow-up after P1 ships.
   */
  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  /** Self-lookup: returns the tenant the JWT belongs to. */
  @Get('self')
  @UseGuards(JwtAuthGuard)
  self(@AuthCtx() auth: AuthContext) {
    return this.tenants.findById(auth.tenantId);
  }
}
