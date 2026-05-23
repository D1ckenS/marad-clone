import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateDischargeLogDto {
  @IsString()
  vesselId!: string;

  @IsString()
  kind!: string;

  @IsDateString()
  occurredAt!: string;

  @IsString()
  location!: string;

  @IsString()
  volume!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  compliant?: boolean;
}

export class UpdateDischargeLogDto {
  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  volume?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  compliant?: boolean;
}
