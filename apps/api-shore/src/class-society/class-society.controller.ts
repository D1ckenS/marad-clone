import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsEnum, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { ClassSociety, ClassSocietyReportType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { ClassSocietyService } from './class-society.service';

class UpsertConnectorDto {
  @IsEnum(ClassSociety)
  society!: ClassSociety;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  apiEndpoint?: string;

  @IsOptional()
  @IsObject()
  vesselRegistrations?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  // H9: shared secret the operator shares with the society. Inbound
  // webhooks must echo this in the X-FleetOps-Webhook-Secret header.
  // Null / unset disables inbound webhooks for this connector.
  @IsOptional()
  @IsString()
  webhookSecret?: string;
}

class WebhookBodyDto {
  @IsString()
  externalRef!: string;

  @IsIn(['ACCEPTED', 'REJECTED'])
  status!: 'ACCEPTED' | 'REJECTED';

  @IsOptional()
  @IsString()
  message?: string;
}

class SubmitDto {
  @IsString()
  vesselId!: string;

  @IsEnum(ClassSociety)
  society!: ClassSociety;

  @IsEnum(ClassSocietyReportType)
  reportType!: ClassSocietyReportType;

  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

@Controller('class-society')
export class ClassSocietyController {
  constructor(private readonly svc: ClassSocietyService) {}

  /**
   * H9: inbound webhook from a class society. UNAUTHENTICATED at the JWT
   * layer — class societies don't carry a FleetOps JWT. Authentication
   * happens inside the service via the `X-FleetOps-Webhook-Secret` header
   * matching the per-connector `webhookSecret`. Declared BEFORE the
   * @UseGuards-decorated routes below so the JwtAuthGuard doesn't apply.
   */
  @Post('webhook/:society')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Param('society') society: string,
    @Headers('x-fleetops-webhook-secret') secret: string | undefined,
    @Body() body: WebhookBodyDto,
  ) {
    return this.svc.applyWebhook(society as ClassSociety, secret, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('connectors')
  listConnectors(@AuthCtx() auth: AuthContext) {
    return this.svc.listConnectors(auth);
  }

  @UseGuards(JwtAuthGuard)
  @Post('connectors')
  upsertConnector(@AuthCtx() auth: AuthContext, @Body() dto: UpsertConnectorDto) {
    return this.svc.upsertConnector(auth, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('submissions')
  listSubmissions(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('society') society?: string,
  ) {
    return this.svc.listSubmissions(auth, vesselId, society as ClassSociety | undefined);
  }

  /** Build a report and optionally submit it to the society's API. */
  @UseGuards(JwtAuthGuard)
  @Post('submit')
  buildAndSubmit(@AuthCtx() auth: AuthContext, @Body() dto: SubmitDto) {
    return this.svc.buildAndSubmit(
      auth,
      dto.vesselId,
      dto.society,
      dto.reportType,
      dto.submit ?? false,
    );
  }

  /** Export a report payload as JSON without creating a submission record. */
  @UseGuards(JwtAuthGuard)
  @Get('export')
  async exportPayload(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId: string,
    @Query('society') society: string,
    @Query('reportType') reportType: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Res() res: any,
  ) {
    const payload = await this.svc.exportPayload(
      auth,
      vesselId,
      society as ClassSociety,
      reportType as ClassSocietyReportType,
    );
    const filename = `${society.toLowerCase()}-${reportType.toLowerCase().replace(/_/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload, null, 2));
  }
}
