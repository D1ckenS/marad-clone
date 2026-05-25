import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateQuoteDto {
  @IsString()
  rfqId!: string;

  @IsString()
  supplierId!: string;

  // totalAmount is derived from SUM(quote_lines.totalPrice).

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
