import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const;

export class CreateProjectTaskDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsIn(TASK_STATUSES) status?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsInt() @Min(1) plannedDays?: number;
  @IsOptional() @IsString() predecessorId?: string;
  @IsOptional() @IsString() assignedToRole?: string;
}

export class UpdateProjectTaskDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsIn(TASK_STATUSES) status?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsInt() @Min(1) plannedDays?: number;
  @IsOptional() @IsString() predecessorId?: string;
  @IsOptional() @IsString() assignedToRole?: string;
}
