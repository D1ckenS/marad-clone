import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Vessel local-password login.
 *
 * Accepts the same shape the shore login does: `identifier` (email — vessel
 * users are looked up by email since the vessel users table has no username
 * column) plus `password`. `tenantId` is optional; when omitted the service
 * looks up the user across all tenants in the vessel SQLite (vessel installs
 * are single-tenant in practice, so this is unambiguous).
 */
export class LoginDto {
  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}
