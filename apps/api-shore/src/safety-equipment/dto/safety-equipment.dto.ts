import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

const CATEGORIES = ['FFA', 'LSA', 'OTH'] as const;
const STATUSES = ['GREEN', 'AMBER', 'RED'] as const;
export type SafetyEquipmentCategoryLiteral = (typeof CATEGORIES)[number];
export type SafetyEquipmentStatusLiteral = (typeof STATUSES)[number];

export class CreateSafetyEquipmentDto {
  @IsString()
  vesselId!: string;

  @IsIn(CATEGORIES as unknown as string[])
  category!: SafetyEquipmentCategoryLiteral;

  @IsString()
  name!: string;

  @IsString()
  location!: string;

  @IsString()
  quantity!: string;

  @IsOptional()
  @IsDateString()
  lastCheck?: string;

  @IsOptional()
  @IsDateString()
  nextCheck?: string;

  @IsOptional()
  @IsIn(STATUSES as unknown as string[])
  status?: SafetyEquipmentStatusLiteral;

  @IsOptional()
  @IsString()
  flag?: string;
}

export class UpdateSafetyEquipmentDto {
  @IsOptional()
  @IsIn(CATEGORIES as unknown as string[])
  category?: SafetyEquipmentCategoryLiteral;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsOptional()
  @IsDateString()
  lastCheck?: string | null;

  @IsOptional()
  @IsDateString()
  nextCheck?: string | null;

  @IsOptional()
  @IsIn(STATUSES as unknown as string[])
  status?: SafetyEquipmentStatusLiteral;

  @IsOptional()
  @IsString()
  flag?: string | null;
}
