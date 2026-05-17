import { IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateDrillDto {
  @IsString()
  vesselId!: string;

  @IsString()
  drillTypeId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  leadOfficer?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateDrillRecordDto {
  @IsString()
  @MinLength(1)
  participantName!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsDateString()
  signedAt?: string;

  @IsOptional()
  @IsString()
  signatureHash?: string;
}

export class UpdateDrillDto {
  @IsOptional()
  @IsString()
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsDateString()
  conductedAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  leadOfficer?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  reportKey?: string;
}
