import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

export class BootstrapAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

/**
 * Bootstrap payload for a fresh tenant. Creates the tenant + a single
 * TENANT_ADMIN user atomically, since otherwise the new tenant has no
 * way to log in (every other write endpoint requires a JWT).
 */
export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  shortName?: string;

  @ValidateNested()
  @Type(() => BootstrapAdminDto)
  admin!: BootstrapAdminDto;
}
