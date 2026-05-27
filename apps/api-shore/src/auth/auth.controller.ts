import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthCtx } from './auth-ctx.decorator';
import type { AuthContext } from './auth-context';
import { JwtAuthGuard } from './jwt-auth.guard';
import { requireRole } from './role.guard';
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
  // H5: throttle refresh too — 30/min is generous for legitimate clients
  // (one refresh every ~12 min with the new 15-min access TTL) and tight
  // enough that someone trying to walk a stolen refresh token can't
  // brute-force rotate at full speed.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  /**
   * H5: admin emergency logout. Marks every outstanding refresh-token
   * session for the target user as revoked. The user's access token is
   * still usable until it expires (15 min by default) but they can't
   * refresh — so within one access-token TTL they're out.
   *
   * - TENANT_ADMIN can revoke users in their own tenant.
   * - SUPER_ADMIN can revoke anyone.
   * - Tenant-scoping is enforced via UserService lookup (which uses
   *   the tenant RLS).
   */
  @Post('sessions/:userId/revoke')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, requireRole('TENANT_ADMIN', 'SUPER_ADMIN'))
  async revokeSessions(@AuthCtx() auth: AuthContext, @Param('userId') userId: string) {
    // Resolve the target user inside the caller's tenant context. For
    // TENANT_ADMIN this naturally constrains revocation to their tenant —
    // a TENANT_ADMIN can't reach into someone else's tenant via this route.
    // SUPER_ADMIN (tenantId=null) can resolve any user via the bypass.
    let target;
    try {
      if (auth.role === 'SUPER_ADMIN') {
        target = await this.users.findSuperAdminByIdentifier(userId).catch(async () => {
          // Not a super-admin id; try a global lookup by id.
          return this.users.findByIdGlobal(userId);
        });
      } else {
        target = await this.users.findByIdInTenant(auth.tenantId!, userId);
      }
    } catch {
      throw new NotFoundException(`User ${userId} not found`);
    }
    return this.auth.revokeAllSessions(target.tenantId, target.id, 'ADMIN_REVOKE');
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
