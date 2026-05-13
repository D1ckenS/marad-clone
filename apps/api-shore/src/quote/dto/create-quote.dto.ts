import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateQuoteDto {
  @IsString()
  rfqId!: string;

  @IsString()
  supplierId!: string;

  @IsOptional()
  @IsString()
  totalAmount?: string;

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
