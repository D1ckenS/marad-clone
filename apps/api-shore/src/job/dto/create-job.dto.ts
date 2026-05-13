import { JobPriority } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateJobDto {
  @IsString()
  componentId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Calendar interval in days. Either this or `intervalRunningHours`
   * must be set — DB CHECK enforces it (jobs_interval_required_chk).
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  intervalDays?: number;

  /** Running-hour interval, decimal string. */
  @IsOptional()
  @IsString()
  intervalRunningHours?: string;

  @IsOptional()
  @IsString()
  estimatedHours?: string;

  @IsOptional()
  @IsEnum(JobPriority)
  priority?: JobPriority;

  /** JSON-encoded array of typical parts: [{ partId, partName, typicalQuantity, unit }] */
  @IsOptional()
  @IsString()
  typicalPartsJson?: string;
}
