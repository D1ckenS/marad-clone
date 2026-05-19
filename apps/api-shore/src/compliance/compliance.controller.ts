import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { ComplianceService } from './compliance.service';

@UseGuards(JwtAuthGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly svc: ComplianceService) {}

  /**
   * DNV CG-0339 type-approval evidence report for a specific vessel.
   * JSON by default; pass ?format=json (same) for programmatic use.
   * The output can be submitted to DNV Veracity via the class-society connector.
   */
  @Get('dnv-type-approval/:vesselId')
  getDnvReport(@AuthCtx() auth: AuthContext, @Param('vesselId') vesselId: string) {
    return this.svc.getDnvTypeApprovalReport(auth, vesselId);
  }

  /** ISO 27001:2022 Annex A readiness assessment for the tenant. */
  @Get('iso27001-readiness')
  getIso27001(@AuthCtx() auth: AuthContext) {
    return this.svc.getIso27001Readiness(auth);
  }

  /** Quick combined status summary (used by CompliancePage dashboard widget). */
  @Get('status/:vesselId')
  getStatus(@AuthCtx() auth: AuthContext, @Param('vesselId') vesselId: string) {
    return this.svc.getComplianceStatus(auth, vesselId);
  }

  /** Export DNV type-approval report as a downloadable JSON file. */
  @Get('dnv-type-approval/:vesselId/export')
  async exportDnvReport(
    @AuthCtx() auth: AuthContext,
    @Param('vesselId') vesselId: string,
    @Query('format') _format: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Res() res: any,
  ) {
    const report = await this.svc.getDnvTypeApprovalReport(auth, vesselId);
    const filename = `dnv-cg-0339-${vesselId}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(report, null, 2));
  }

  /** Export ISO 27001 assessment as a downloadable JSON file. */
  @Get('iso27001-readiness/export')
  async exportIso27001(
    @AuthCtx() auth: AuthContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Res() res: any,
  ) {
    const report = await this.svc.getIso27001Readiness(auth);
    const filename = `iso27001-readiness-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(report, null, 2));
  }
}
