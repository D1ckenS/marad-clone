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
import { InspectionService } from './inspection.service';
import { CreateInspectionDto, UpdateInspectionDto } from './dto/inspection.dto';

@Controller('inspections')
@UseGuards(JwtAuthGuard)
export class InspectionController {
  constructor(private readonly svc: InspectionService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateInspectionDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('kind') kind?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(vesselId !== undefined && { vesselId }),
      ...(kind !== undefined && { kind }),
    });
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateInspectionDto) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
