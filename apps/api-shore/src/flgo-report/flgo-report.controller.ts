import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FlgoReportService } from './flgo-report.service';

@Controller('flgo-reports')
@UseGuards(JwtAuthGuard)
export class FlgoReportController {
  constructor(private readonly svc: FlgoReportService) {}

  @Get(':vesselId/imo-dcs')
  @Header('Content-Type', 'application/xml')
  getImoDcsXml(
    @AuthCtx() auth: AuthContext,
    @Param('vesselId') vesselId: string,
    @Query('year') year: string,
  ) {
    return this.svc.getImoDcsXml(auth, vesselId, parseInt(year, 10) || new Date().getFullYear());
  }

  @Get(':vesselId/eu-mrv')
  getEuMrvSummary(
    @AuthCtx() auth: AuthContext,
    @Param('vesselId') vesselId: string,
    @Query('year') year: string,
  ) {
    return this.svc.getEuMrvSummary(auth, vesselId, parseInt(year, 10) || new Date().getFullYear());
  }

  @Get(':vesselId/cii')
  getCiiRating(
    @AuthCtx() auth: AuthContext,
    @Param('vesselId') vesselId: string,
    @Query('year') year: string,
  ) {
    return this.svc.getCiiRating(auth, vesselId, parseInt(year, 10) || new Date().getFullYear());
  }
}
