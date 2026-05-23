import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const INSPECTION_KINDS = ['PSC', 'VETTING', 'FLAG'] as const;
export type InspectionKindLiteral = (typeof INSPECTION_KINDS)[number];

export class CreateInspectionDto {
  @IsString()
  vesselId!: string;

  @IsDateString()
  inspectedAt!: string;

  @IsIn(INSPECTION_KINDS as unknown as string[])
  kind!: InspectionKindLiteral;

  @IsOptional()
  @IsString()
  mou?: string;

  @IsString()
  port!: string;

  @IsString()
  inspector!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  deficiencies?: number;

  @IsOptional()
  @IsBoolean()
  detained?: boolean;

  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  findings?: string;
}

export class UpdateInspectionDto {
  @IsOptional()
  @IsDateString()
  inspectedAt?: string;

  @IsOptional()
  @IsIn(INSPECTION_KINDS as unknown as string[])
  kind?: InspectionKindLiteral;

  @IsOptional()
  @IsString()
  mou?: string | null;

  @IsOptional()
  @IsString()
  port?: string;

  @IsOptional()
  @IsString()
  inspector?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  deficiencies?: number;

  @IsOptional()
  @IsBoolean()
  detained?: boolean;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  findings?: string | null;
}
