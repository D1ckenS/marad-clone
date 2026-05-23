import { IsArray, IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateJhaDto {
  @IsString()
  ref!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  activity?: string;

  @IsArray()
  hazards!: unknown[];

  @IsArray()
  controls!: unknown[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  residualL?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  residualS?: number;

  @IsOptional()
  @IsDateString()
  reviewedAt?: string;

  @IsOptional()
  @IsString()
  reviewedBy?: string;
}

export class UpdateJhaDto {
  @IsOptional()
  @IsString()
  ref?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  activity?: string | null;

  @IsOptional()
  @IsArray()
  hazards?: unknown[];

  @IsOptional()
  @IsArray()
  controls?: unknown[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  residualL?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  residualS?: number;

  @IsOptional()
  @IsDateString()
  reviewedAt?: string | null;

  @IsOptional()
  @IsString()
  reviewedBy?: string | null;
}
