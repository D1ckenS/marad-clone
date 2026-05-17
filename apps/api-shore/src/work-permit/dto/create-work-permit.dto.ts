import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const PERMIT_TYPES = [
  'HOT_WORK',
  'CONFINED_SPACE',
  'WORKING_AT_HEIGHT',
  'ELECTRICAL_ISOLATION',
  'COLD_WORK',
  'DIVING',
  'OVERSIDE_WORK',
] as const;

export class CreateWorkPermitDto {
  @IsString()
  vesselId!: string;

  @IsIn(PERMIT_TYPES)
  permitType!: (typeof PERMIT_TYPES)[number];

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  workDescription?: string;

  @IsOptional()
  @IsString()
  requestedByUserId?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

export class UpdateWorkPermitDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  workDescription?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  riskAssessmentJson?: string;

  @IsOptional()
  @IsString()
  gasTestJson?: string;

  @IsOptional()
  @IsString()
  hazardsJson?: string;
}

export class AddPermitApprovalDto {
  @IsString()
  @MinLength(1)
  approvedBy!: string;

  @IsString()
  @MinLength(1)
  role!: string;

  @IsOptional()
  @IsString()
  signatureHash?: string;
}
