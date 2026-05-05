import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { VesselService } from './vessel.service';
import { CreateVesselDto } from './dto/create-vessel.dto';

@Controller('tenants/:tenantId/vessels')
export class VesselController {
  constructor(private readonly vessels: VesselService) {}

  @Post()
  create(@Param('tenantId') tenantId: string, @Body() dto: CreateVesselDto) {
    return this.vessels.create(tenantId, dto);
  }

  @Get()
  findAll(@Param('tenantId') tenantId: string) {
    return this.vessels.findByTenant(tenantId);
  }

  @Get(':id')
  findOne(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.vessels.findById(tenantId, id);
  }
}
