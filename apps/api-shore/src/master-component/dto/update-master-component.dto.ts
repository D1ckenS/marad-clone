import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMasterComponentDto {
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
  category?: string;
}
