import { JobInstanceStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateJobInstanceDto {
  @IsOptional()
  @IsEnum(JobInstanceStatus)
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
