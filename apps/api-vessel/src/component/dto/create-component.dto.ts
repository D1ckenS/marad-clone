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

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  masterId?: string;

  @IsOptional()
  @IsString()
  runningHours?: string;
}
