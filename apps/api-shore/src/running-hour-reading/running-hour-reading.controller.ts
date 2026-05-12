import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRunningHourReadingDto } from './dto/create-running-hour-reading.dto';
import { RunningHourReadingService } from './running-hour-reading.service';

@Controller('running-hour-readings')
@UseGuards(JwtAuthGuard)
export class RunningHourReadingController {
  constructor(private readonly readings: RunningHourReadingService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateRunningHourReadingDto) {
    return this.readings.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext, @Query('componentId') componentId?: string) {
    return this.readings.findAll(auth, componentId);
  }
}
