import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditEventService } from './audit-event.service';

@Controller('audit-events')
@UseGuards(JwtAuthGuard)
export class AuditEventController {
  constructor(private readonly svc: AuditEventService) {}

  @Get()
  findAll(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(vesselId !== undefined && { vesselId }),
      ...(entityType !== undefined && { entityType }),
      ...(action !== undefined && { action }),
      ...(limit !== undefined && { limit: parseInt(limit, 10) }),
    });
  }

  @Get('dnv-evidence/:vesselId')
  getDnvEvidence(@AuthCtx() auth: AuthContext, @Param('vesselId') vesselId: string) {
    return this.svc.getDnvEvidence(auth, vesselId);
  }
}
