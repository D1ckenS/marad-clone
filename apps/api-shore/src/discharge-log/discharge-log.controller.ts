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
import { DischargeLogService } from './discharge-log.service';
import { CreateDischargeLogDto, UpdateDischargeLogDto } from './dto/discharge-log.dto';

@Controller('discharge-logs')
@UseGuards(JwtAuthGuard)
export class DischargeLogController {
  constructor(private readonly svc: DischargeLogService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateDischargeLogDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext, @Query('vesselId') vesselId?: string) {
    return this.svc.findAll(auth, { ...(vesselId !== undefined && { vesselId }) });
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateDischargeLogDto,
  ) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
