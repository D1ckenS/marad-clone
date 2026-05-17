import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateVesselDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  imoNumber?: string;
}
