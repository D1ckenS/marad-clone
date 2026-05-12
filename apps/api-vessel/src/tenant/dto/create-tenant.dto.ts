import { Type } from 'class-transformer';
import { IsEmail, IsString, MinLength, ValidateNested } from 'class-validator';

export class BootstrapAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

/**
 * Bootstrap payload for a fresh tenant on the vessel-local install. Creates
 * the tenant + a TENANT_ADMIN user atomically. In normal operation the
 * vessel install is provisioned this way once; subsequent users come from
 * shore via sync.
 */
export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @ValidateNested()
  @Type(() => BootstrapAdminDto)
  admin!: BootstrapAdminDto;
}
