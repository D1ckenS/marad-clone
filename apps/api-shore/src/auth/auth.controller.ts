import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UserService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.tenantId ?? null, dto.identifier, dto.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  /**
   * One-time bootstrap to create the platform super-admin.
   * Protected by PLATFORM_BOOTSTRAP_KEY env var — keep this secret.
   * Idempotent: returns 409 if an account with this email already exists.
   */
  @Post('bootstrap-super-admin')
  @HttpCode(HttpStatus.CREATED)
  async bootstrapSuperAdmin(
    @Body() dto: { bootstrapKey: string; email: string; username: string; password: string },
  ) {
    const envKey = process.env['PLATFORM_BOOTSTRAP_KEY'];
    if (!envKey || dto.bootstrapKey !== envKey) {
      throw new ForbiddenException('Invalid bootstrap key');
    }
    return this.users.createSuperAdmin(dto.email, dto.password, dto.username);
  }
}
