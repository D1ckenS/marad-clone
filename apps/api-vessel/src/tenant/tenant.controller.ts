import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantService } from './tenant.service';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  /** Bootstrap path — open. Creates tenant + initial TENANT_ADMIN. */
  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  /** SUPER_ADMIN list — backs the Companies page on the vessel SPA. */
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@AuthCtx() auth: AuthContext) {
    if (auth.role !== 'SUPER_ADMIN') return [];
    return this.tenants.findAll();
  }

  /** Self-lookup: returns the tenant the JWT belongs to. */
  @Get('self')
  @UseGuards(JwtAuthGuard)
  self(@AuthCtx() auth: AuthContext) {
    if (auth.tenantId === null) return null; // SUPER_ADMIN
    return this.tenants.findById(auth.tenantId);
  }

  /** SUPER_ADMIN: update tenant name. */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: { name?: string }) {
    if (auth.role !== 'SUPER_ADMIN') throw new ForbiddenException('SUPER_ADMIN only');
    return this.tenants.update(id, dto);
  }
}
