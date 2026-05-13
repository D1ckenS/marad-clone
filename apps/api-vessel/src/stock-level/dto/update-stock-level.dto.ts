import { IsNumberString, IsOptional } from 'class-validator';

export class UpdateStockLevelDto {
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
