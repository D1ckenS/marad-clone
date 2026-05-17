import { IsOptional, IsString } from 'class-validator';

export class UpdateDrillTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
