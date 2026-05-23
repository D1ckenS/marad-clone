import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAuditFindingDto {
  @IsString()
  vesselId!: string;

  @IsOptional()
  @IsString()
  auditId?: string;

  @IsString()
  classification!: string;

  @IsOptional()
  @IsString()
  smsRef?: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsDateString()
  openedAt!: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsDateString()
  closedAt?: string;
}

export class UpdateAuditFindingDto {
  @IsOptional()
  @IsString()
  auditId?: string | null;

  @IsOptional()
  @IsString()
  classification?: string;

  @IsOptional()
  @IsString()
  smsRef?: string | null;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  detail?: string | null;

  @IsOptional()
  @IsString()
  owner?: string | null;

  @IsOptional()
  @IsDateString()
  openedAt?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsDateString()
  closedAt?: string | null;
}
