import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
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

@UseGuards(JwtAuthGuard)
@Controller('class-society')
export class ClassSocietyController {
  constructor(private readonly svc: ClassSocietyService) {}

  @Get('connectors')
  listConnectors(@AuthCtx() auth: AuthContext) {
    return this.svc.listConnectors(auth);
  }

  @Post('connectors')
  upsertConnector(@AuthCtx() auth: AuthContext, @Body() dto: UpsertConnectorDto) {
    return this.svc.upsertConnector(auth, dto);
  }

  @Get('submissions')
  listSubmissions(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('society') society?: string,
  ) {
    return this.svc.listSubmissions(auth, vesselId, society as ClassSociety | undefined);
  }

  /** Build a report and optionally submit it to the society's API. */
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
