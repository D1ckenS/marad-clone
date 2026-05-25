import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreatePurchaseOrderDto {
  @IsString()
  title!: string;

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

  // totalAmount is derived from SUM(po_lines.totalPrice). See
  // PurchaseOrderService.recomputeTotal — clients can't set it.

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  expectedDeliveryAt?: string;
}
