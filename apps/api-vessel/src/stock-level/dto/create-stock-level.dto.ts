import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateStockLevelDto {
  @IsString()
  partId!: string;

  @IsString()
  locationId!: string;

  @IsOptional()
  @IsNumberString()
  minStock?: string;

  @IsOptional()
  @IsNumberString()
  maxStock?: string;

  @IsOptional()
  @IsNumberString()
  reorderPoint?: string;
}
