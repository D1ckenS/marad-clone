import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GrnLineDto {
  @IsString()
  poLineId!: string;

  @IsString()
  quantityReceived!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrnLineDto)
  lines!: GrnLineDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
