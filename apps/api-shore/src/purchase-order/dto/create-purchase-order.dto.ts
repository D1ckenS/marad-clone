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

  // totalAmount is intentionally NOT writable — it is derived from
  // SUM(po_lines.totalPrice WHERE deleted_at IS NULL). The service
  // recomputes it whenever lines change. Clients should not send it;
  // ValidationPipe's whitelist will silently strip the field if they do.

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  expectedDeliveryAt?: string;
}
