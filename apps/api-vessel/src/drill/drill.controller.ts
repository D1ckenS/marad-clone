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
import { DrillService } from './drill.service';
import { CreateDrillDto, CreateDrillRecordDto, UpdateDrillDto } from './dto/create-drill.dto';

@Controller('drills')
@UseGuards(JwtAuthGuard)
export class DrillController {
  constructor(private readonly svc: DrillService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateDrillDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(
    @AuthCtx() auth: AuthContext,
    @Query('status') status?: string,
    @Query('vesselId') vesselId?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(status !== undefined && { status }),
      ...(vesselId !== undefined && { vesselId }),
    });
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateDrillDto) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }

  @Post(':id/records')
  addRecord(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: CreateDrillRecordDto,
  ) {
    return this.svc.addRecord(auth, id, dto);
  }
}
