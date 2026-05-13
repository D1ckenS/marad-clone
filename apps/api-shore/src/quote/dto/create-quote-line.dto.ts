import { IsOptional, IsString } from 'class-validator';

export class CreateQuoteLineDto {
  @IsOptional()
  @IsString()
  partId?: string;

  @IsString()
  description!: string;

  @IsString()
  quantity!: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsString()
  unitPrice!: string;

  @IsString()
  totalPrice!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
