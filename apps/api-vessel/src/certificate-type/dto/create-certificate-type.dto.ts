import { IsArray, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCertificateTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  alertDays?: number[];
}
