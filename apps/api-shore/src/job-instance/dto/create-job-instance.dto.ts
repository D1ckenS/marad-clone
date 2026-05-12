import { JobInstanceStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateJobInstanceDto {
  @IsString()
  jobId!: string;

  @IsString()
  componentId!: string;

  @IsOptional()
  @IsEnum(JobInstanceStatus)
  status?: JobInstanceStatus;

  /** Calendar due date (UTC ISO 8601). */
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  /** Running-hour due value (decimal string). */
  @IsOptional()
  @IsString()
  dueAtRunningHours?: string;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;
}
