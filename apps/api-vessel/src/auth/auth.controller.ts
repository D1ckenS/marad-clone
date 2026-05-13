import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyShoreTokenDto } from './dto/verify-shore-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Local password login — vessel-local HS256 token, dev-only.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.tenantId, dto.email, dto.password);
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
