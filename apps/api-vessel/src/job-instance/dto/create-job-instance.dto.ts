import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { JOB_INSTANCE_STATUSES, type JobInstanceStatus } from '../../db/schema';

export class CreateJobInstanceDto {
  @IsString()
  jobId!: string;

  @IsString()
  componentId!: string;

  @IsOptional()
  @IsIn(JOB_INSTANCE_STATUSES)
  status?: JobInstanceStatus;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  dueAtRunningHours?: string;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;
}
