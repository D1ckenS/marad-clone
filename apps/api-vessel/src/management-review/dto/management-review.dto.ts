import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'CLOSED', 'CANCELLED'] as const;
export type ManagementReviewStatusLiteral = (typeof STATUSES)[number];

export class CreateManagementReviewDto {
  @IsString()
  kind!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsString()
  chair!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  attendees?: number;

  @IsOptional()
  @IsIn(STATUSES as unknown as string[])
  status?: ManagementReviewStatusLiteral;

  @IsOptional()
  @IsInt()
  @Min(0)
  actionsTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  actionsDone?: number;

  @IsOptional()
  @IsString()
  summary?: string;
}

export class UpdateManagementReviewDto {
  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  chair?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  attendees?: number;

  @IsOptional()
  @IsIn(STATUSES as unknown as string[])
  status?: ManagementReviewStatusLiteral;

  @IsOptional()
  @IsInt()
  @Min(0)
  actionsTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  actionsDone?: number;

  @IsOptional()
  @IsString()
  summary?: string | null;
}
