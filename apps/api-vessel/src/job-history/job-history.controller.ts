import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JobHistoryService } from './job-history.service';

@Controller('job-histories')
@UseGuards(JwtAuthGuard)
export class JobHistoryController {
  constructor(private readonly histories: JobHistoryService) {}

  @Get()
  findAll(@AuthCtx() auth: AuthContext, @Query('jobInstanceId') jobInstanceId?: string) {
    return this.histories.findAll(auth, jobInstanceId);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.histories.findOne(auth, id);
  }
}
