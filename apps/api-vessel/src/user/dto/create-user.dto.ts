import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ROLES, type Role } from '../../db/schema';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @IsOptional()
  @IsString()
  vesselId?: string;
}
