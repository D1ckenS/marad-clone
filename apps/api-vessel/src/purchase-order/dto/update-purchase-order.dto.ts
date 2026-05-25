import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  requisitionId?: string;

  @IsOptional()
  @IsString()
  rfqId?: string;

  @IsOptional()
  @IsString()
  poNumber?: string;

  // totalAmount is derived; see CreatePurchaseOrderDto.

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  expectedDeliveryAt?: string;
}
