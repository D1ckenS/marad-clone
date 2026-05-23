import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const SURVEY_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'POSTPONED',
  'CANCELLED',
] as const;
export type SurveyStatusLiteral = (typeof SURVEY_STATUSES)[number];

export class CreateSurveyDto {
  @IsString()
  vesselId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsString()
  @MinLength(1)
  kind!: string;

  @IsString()
  @MinLength(1)
  scope!: string;

  @IsString()
  @MinLength(1)
  surveyor!: string;

  @IsString()
  @MinLength(1)
  location!: string;

  @IsOptional()
  @IsIn(SURVEY_STATUSES as unknown as string[])
  status?: SurveyStatusLiteral;

  @IsOptional()
  @IsString()
  certificateId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSurveyDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  surveyor?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(SURVEY_STATUSES as unknown as string[])
  status?: SurveyStatusLiteral;

  @IsOptional()
  @IsString()
  certificateId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
