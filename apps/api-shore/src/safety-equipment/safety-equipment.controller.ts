import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SafetyEquipmentService } from './safety-equipment.service';
import { CreateSafetyEquipmentDto, UpdateSafetyEquipmentDto } from './dto/safety-equipment.dto';

@Controller('safety-equipment')
@UseGuards(JwtAuthGuard)
export class SafetyEquipmentController {
  constructor(private readonly svc: SafetyEquipmentService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateSafetyEquipmentDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('category') category?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(vesselId !== undefined && { vesselId }),
      ...(category !== undefined && { category }),
    });
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateSafetyEquipmentDto,
  ) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
