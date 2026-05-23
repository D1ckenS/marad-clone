import { IsDateString, IsIn, IsNumberString, IsOptional, IsString } from 'class-validator';

const MODES = ['LADEN', 'BALLAST'] as const;
export type VoyageModeLiteral = (typeof MODES)[number];

// Decimal fields are passed as string-encoded decimals so we never lose precision in JS.

export class CreateVoyageLegDto {
  @IsString()
  vesselId!: string;

  @IsString()
  route!: string;

  @IsDateString()
  departureAt!: string;

  @IsDateString()
  arrivalAt!: string;

  @IsNumberString()
  nm!: string;

  @IsNumberString()
  fuelTonnes!: string;

  @IsNumberString()
  co2Tonnes!: string;

  @IsNumberString()
  soxTonnes!: string;

  @IsNumberString()
  noxTonnes!: string;

  @IsNumberString()
  hours!: string;

  @IsIn(MODES as unknown as string[])
  mode!: VoyageModeLiteral;

  @IsOptional()
  @IsString()
  cargo?: string;
}

export class UpdateVoyageLegDto {
  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsDateString()
  departureAt?: string;

  @IsOptional()
  @IsDateString()
  arrivalAt?: string;

  @IsOptional()
  @IsNumberString()
  nm?: string;

  @IsOptional()
  @IsNumberString()
  fuelTonnes?: string;

  @IsOptional()
  @IsNumberString()
  co2Tonnes?: string;

  @IsOptional()
  @IsNumberString()
  soxTonnes?: string;

  @IsOptional()
  @IsNumberString()
  noxTonnes?: string;

  @IsOptional()
  @IsNumberString()
  hours?: string;

  @IsOptional()
  @IsIn(MODES as unknown as string[])
  mode?: VoyageModeLiteral;

  @IsOptional()
  @IsString()
  cargo?: string | null;
}
