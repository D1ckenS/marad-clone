import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { OidcService } from './oidc.service';

class OidcCallbackDto {
  @IsString()
  code!: string;

  @IsString()
  state!: string;
}

@Controller('auth/oidc')
export class OidcController {
  constructor(private readonly oidc: OidcService) {}

  /** Begin the OIDC login flow. Returns the IDP authorization URL the
   *  client should redirect the user to. */
  @Get('login')
  beginLogin() {
    return this.oidc.beginLogin();
  }

  /** Complete the OIDC login flow. The IDP posts the auth code + state
   *  back to this endpoint; we exchange and mint a shore JWT pair. */
  @Post('callback')
  async callback(@Body() dto: OidcCallbackDto) {
    return this.oidc.completeLogin(dto.code, dto.state);
  }
}
