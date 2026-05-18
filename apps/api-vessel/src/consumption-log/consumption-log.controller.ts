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
import { ConsumptionLogService } from './consumption-log.service';
import { CreateConsumptionLogDto, UpdateConsumptionLogDto } from './dto/create-consumption-log.dto';

@Controller('consumption-logs')
@UseGuards(JwtAuthGuard)
export class ConsumptionLogController {
  constructor(private readonly svc: ConsumptionLogService) {}
  @Post() create(@AuthCtx() auth: AuthContext, @Body() dto: CreateConsumptionLogDto) {
    return this.svc.create(auth, dto);
  }
  @Get() findAll(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('consumerType') consumerType?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(vesselId !== undefined && { vesselId }),
      ...(from !== undefined && { from }),
      ...(to !== undefined && { to }),
      ...(consumerType !== undefined && { consumerType }),
    });
  }
  @Get(':id') findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }
  @Patch(':id') update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateConsumptionLogDto,
  ) {
    return this.svc.update(auth, id, dto);
  }
  @Delete(':id') @HttpCode(204) remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
