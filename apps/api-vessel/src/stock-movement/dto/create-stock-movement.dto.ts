import { IsDateString, IsIn, IsNumberString, IsOptional, IsString } from 'class-validator';

const MOVEMENT_TYPES = [
  'CONSUMPTION',
  'RECEIPT',
  'ADJUSTMENT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
] as const;
export type StockMovementTypeDto = (typeof MOVEMENT_TYPES)[number];

export class CreateStockMovementDto {
  @IsString()
  partId!: string;

  @IsString()
  locationId!: string;

  @IsIn(MOVEMENT_TYPES)
  movementType!: StockMovementTypeDto;

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsDateString()
  recordedAt!: string;
}
