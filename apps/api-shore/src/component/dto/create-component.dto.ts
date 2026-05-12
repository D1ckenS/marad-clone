import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateComponentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sfi?: string;

  /** Optional parent component for hierarchy. */
  @IsOptional()
  @IsString()
  parentId?: string;

  /** Optional master component this is cloned from. */
  @IsOptional()
  @IsString()
  masterId?: string;

  /** Initial running hours, decimal string. Defaults to "0". */
  @IsOptional()
  @IsString()
  runningHours?: string;
}
