import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateCertificateDto {
  @IsString()
  @IsOptional()
  number?: string;

  @IsDateString()
  @IsOptional()
  issuedAt?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsString()
  @IsOptional()
  issuedBy?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
