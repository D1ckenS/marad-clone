import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateCertificateTypeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  alertDays?: number[];
}
