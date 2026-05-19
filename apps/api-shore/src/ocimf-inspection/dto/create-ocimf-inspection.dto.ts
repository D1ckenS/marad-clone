import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { OcimfInspectionType } from '@prisma/client';

export class CreateOcimfInspectionDto {
  @IsString()
  vesselId!: string;

  @IsEnum(OcimfInspectionType)
  inspectionType!: OcimfInspectionType;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'inspectionDate must be YYYY-MM-DD' })
  inspectionDate!: string;

  @IsOptional()
  @IsString()
  inspector?: string;

  @IsOptional()
  @IsString()
  port?: string;

  @IsOptional()
  @IsString()
  reportNumber?: string;

  @IsOptional()
  overallScore?: number;

  @IsOptional()
  observationsJson?: unknown[];
}
