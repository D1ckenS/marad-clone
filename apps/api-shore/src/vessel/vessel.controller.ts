import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { requireRole } from '../auth/role.guard';
import { CreateVesselDto } from './dto/create-vessel.dto';
import { UpdateVesselDto } from './dto/update-vessel.dto';
import { VesselService } from './vessel.service';

@Controller('vessels')
@UseGuards(JwtAuthGuard)
export class VesselController {
  constructor(private readonly vessels: VesselService) {}

  @Post()
  @UseGuards(requireRole('SUPER_ADMIN', 'TENANT_ADMIN'))
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateVesselDto) {
    return this.vessels.create(auth.tenantId!, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext) {
    return this.vessels.findByTenant(auth.tenantId!);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.vessels.findById(auth.tenantId!, id);
  }

  @Patch(':id')
  @UseGuards(requireRole('SUPER_ADMIN', 'TENANT_ADMIN'))
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateVesselDto) {
    return this.vessels.update(auth.tenantId!, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(requireRole('SUPER_ADMIN', 'TENANT_ADMIN'))
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.vessels.softDelete(auth.tenantId!, id);
  }
}
