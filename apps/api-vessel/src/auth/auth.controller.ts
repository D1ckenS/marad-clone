import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyShoreTokenDto } from './dto/verify-shore-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Local password login — vessel-local HS256 token, dev-only.
   * H4: 10 attempts / 60s per IP, same threshold as shore.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.identifier, dto.password, dto.tenantId);
  }

  /**
   * First-launch provisioning. Creates the initial tenant/vessel/admin row
   * when the vessel SQLite is empty. Gated by the VESSEL_BOOTSTRAP_KEY env
   * var configured at install time.
   */
  @Post('bootstrap-vessel-admin')
  @HttpCode(HttpStatus.CREATED)
  bootstrap(@Body() dto: BootstrapAdminDto) {
    return this.auth.bootstrapAdmin(dto);
  }

  /**
   * Public probe used by the SPA to decide whether to render the
   * first-launch setup wizard vs the normal login form.
   */
  @Get('setup-status')
  setupStatus() {
    return this.auth.getSetupStatus();
  }

  /**
   * Verify a shore-issued RS256 access token. Returns the decoded
   * claim set on success, 401 on failure. Used by clients that already
   * have a shore-issued token (delivered via sync or out-of-band) and
   * want to confirm vessel-side validity before making API calls.
   */
  @Post('verify-shore-token')
  @HttpCode(HttpStatus.OK)
  async verifyShoreToken(@Body() dto: VerifyShoreTokenDto) {
    const payload = await this.auth.verifyShoreToken(dto.access_token);
    return {
      sub: payload.sub,
      tenantId: payload.tenantId,
      vesselId: payload.vesselId ?? null,
      email: payload.email,
      role: payload.role,
      issuer: payload.iss ?? 'fleetops-shore',
      expiresAtUnixMs: payload.exp !== undefined ? payload.exp * 1000 : null,
    };
  }
}
