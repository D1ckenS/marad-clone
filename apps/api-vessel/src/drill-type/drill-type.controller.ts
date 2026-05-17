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
import { DrillTypeService } from './drill-type.service';
import { CreateDrillTypeDto, UpdateDrillTypeDto } from './dto/create-drill-type.dto';

@Controller('drill-types')
@UseGuards(JwtAuthGuard)
export class DrillTypeController {
  constructor(private readonly svc: DrillTypeService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateDrillTypeDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext) {
    return this.svc.findAll(auth);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateDrillTypeDto) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
