import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const COC_SEVERITIES = ['CONDITION', 'RECOMMENDATION', 'MEMORANDUM', 'CLOSED'] as const;
export type CocSeverityLiteral = (typeof COC_SEVERITIES)[number];

export class CreateConditionOfClassDto {
  @IsString()
  vesselId!: string;

  @IsIn(COC_SEVERITIES as unknown as string[])
  severity!: CocSeverityLiteral;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  detail!: string;

  @IsDateString()
  raisedAt!: string;

  @IsDateString()
  openedAt!: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsDateString()
  closedAt?: string;

  @IsOptional()
  @IsString()
  linkedCertificateId?: string;
}

export class UpdateConditionOfClassDto {
  @IsOptional()
  @IsIn(COC_SEVERITIES as unknown as string[])
  severity?: CocSeverityLiteral;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @IsDateString()
  raisedAt?: string;

  @IsOptional()
  @IsDateString()
  openedAt?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsDateString()
  closedAt?: string | null;

  @IsOptional()
  @IsString()
  linkedCertificateId?: string | null;
}
