import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateVesselDto } from './dto/create-vessel.dto';
import { VesselService } from './vessel.service';

/**
 * Vessel-side `/vessels`. Authenticated; tenantId from JWT.
 */
@Controller('vessels')
@UseGuards(JwtAuthGuard)
export class VesselController {
  constructor(private readonly vessels: VesselService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateVesselDto) {
    return this.vessels.create(auth.tenantId, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext) {
    return this.vessels.findByTenant(auth.tenantId);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.vessels.findById(auth.tenantId, id);
  }
}
