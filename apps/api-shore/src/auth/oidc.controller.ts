import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { SsoProvider } from '@prisma/client';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthCtx } from './auth-ctx.decorator';
import type { AuthContext } from './auth-context';
import { OidcService } from './oidc.service';

class OidcCallbackDto {
  @IsString()
  code!: string;

  @IsString()
  state!: string;
}

class UpsertSsoConfigDto {
  @IsEnum(SsoProvider)
  provider!: SsoProvider;

  @IsUrl({ require_tld: false })
  discoveryUrl!: string;

  @IsString()
  clientId!: string;

  @IsString()
  clientSecret!: string;

  @IsString()
  redirectUri!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@Controller('auth/oidc')
export class OidcController {
  constructor(private readonly oidc: OidcService) {}

  /** Begin OIDC login. Returns the IDP authorization URL + state JWT. */
  @Get('login')
  beginLogin(@Query('tenantId') tenantId: string, @Query('provider') provider?: string) {
    const p = provider === 'GOOGLE' ? SsoProvider.GOOGLE : SsoProvider.ENTRA;
    return this.oidc.beginLogin(tenantId, p);
  }

  /** Complete the OIDC flow. Exchange code+state for FleetOps JWT pair. */
  @Post('callback')
  callback(@Body() dto: OidcCallbackDto) {
    return this.oidc.completeLogin(dto.code, dto.state);
  }

  /** Get all SSO configs for the caller's tenant. */
  @UseGuards(JwtAuthGuard)
  @Get('configs')
  getConfigs(@AuthCtx() auth: AuthContext) {
    return this.oidc.getSsoConfigs(auth.tenantId!);
  }

  /** Upsert an SSO config for a specific provider. */
  @UseGuards(JwtAuthGuard)
  @Post('config')
  upsertConfig(@AuthCtx() auth: AuthContext, @Body() dto: UpsertSsoConfigDto) {
    return this.oidc.upsertSsoConfig(auth.tenantId!, dto);
  }
}
