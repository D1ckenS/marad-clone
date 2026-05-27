import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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

  // M6: Fleetview tile data — non-compliant discharge count YTD.
  // Placed BEFORE the `:id` route so "non-compliant-ytd" isn't
  // interpreted as an ID by Nest's path matcher.
  @Get('non-compliant-ytd')
  nonCompliantYtd(@AuthCtx() auth: AuthContext, @Query('vesselId') vesselId?: string) {
    return this.svc.nonCompliantYtd(auth, vesselId);
  }

  // M6: IOPP-format CSV export. Same auth + tenant scope as the list
  // endpoint; query filter on vesselId + ISO date range.
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="discharge-logs.csv"')
  exportCsv(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.exportCsv(auth, {
      ...(vesselId !== undefined && { vesselId }),
      ...(from !== undefined && { from }),
      ...(to !== undefined && { to }),
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
