import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { JOB_PRIORITIES, type JobPriority } from '../../db/schema';

export class CreateJobDto {
  @IsString()
  componentId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  intervalDays?: number;

  @IsOptional()
  @IsString()
  intervalRunningHours?: string;

  @IsOptional()
  @IsString()
  estimatedHours?: string;

  @IsOptional()
  @IsIn(JOB_PRIORITIES)
  priority?: JobPriority;
}
