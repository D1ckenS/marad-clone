import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { BiService } from './bi.service';

class UpsertDashboardDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  supersetDashboardId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('bi')
export class BiController {
  constructor(private readonly svc: BiService) {}

  /** Enabled dashboards visible to end users. */
  @Get('dashboards')
  listDashboards(@AuthCtx() auth: AuthContext) {
    return this.svc.listDashboards(auth);
  }

  /** All dashboards including disabled (admin view). */
  @Get('dashboards/all')
  listAll(@AuthCtx() auth: AuthContext) {
    return this.svc.listAllDashboards(auth);
  }

  @Post('dashboards')
  upsertDashboard(@AuthCtx() auth: AuthContext, @Body() dto: UpsertDashboardDto) {
    return this.svc.upsertDashboard(auth, dto);
  }

  @Delete('dashboards/:id')
  @HttpCode(204)
  removeDashboard(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.removeDashboard(auth, id);
  }

  /**
   * Returns a Superset guest token for embedding the given dashboard.
   * The token is scoped to the caller's tenant via Superset RLS.
   */
  @Get('guest-token/:id')
  async getGuestToken(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    const token = await this.svc.getGuestToken(auth, id);
    return { token, supersetUrl: this.svc.getSupersetUrl() };
  }

  /** Returns the Superset URL so the frontend SDK knows where to connect. */
  @Get('config')
  getConfig() {
    return { supersetUrl: this.svc.getSupersetUrl() };
  }
}
