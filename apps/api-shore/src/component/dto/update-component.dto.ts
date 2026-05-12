import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateComponentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sfi?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  runningHours?: string;
}
