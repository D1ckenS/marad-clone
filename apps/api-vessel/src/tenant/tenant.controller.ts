import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenants.findById(id);
  }
}
