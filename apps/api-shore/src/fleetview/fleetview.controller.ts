import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { FleetviewService } from './fleetview.service';

@UseGuards(JwtAuthGuard)
@Controller('fleetview')
export class FleetviewController {
  constructor(private readonly svc: FleetviewService) {}

  /** Fleet KPIs + per-vessel status pills. No vessel required — aggregates all vessels. */
  @Get('summary')
  getSummary(@AuthCtx() auth: AuthContext) {
    return this.svc.getSummary(auth);
  }

  /** Cross-vessel worklist: overdue jobs, pending approvals, expiring certs, open findings. */
  @Get('worklist')
  getWorklist(@AuthCtx() auth: AuthContext, @Query('limit') limit?: string) {
    return this.svc.getWorklist(auth, limit ? parseInt(limit, 10) : 50);
  }

  /** Budget vs actuals for a given year. */
  @Get('budget-actuals')
  getBudgetActuals(@AuthCtx() auth: AuthContext, @Query('year') year?: string) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.svc.getBudgetActuals(auth, y);
  }
}
