import { IsOptional, IsString } from 'class-validator';

export class CreateRequisitionLineDto {
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

  @IsOptional()
  @IsString()
  estimatedUnitPrice?: string;

  @IsOptional()
  @IsString()
  estimatedTotalPrice?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
