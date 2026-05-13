import { IsString, MinLength } from 'class-validator';

export class CreateBarcodeBindingDto {
  @IsString()
  partId!: string;

  @IsString()
  @MinLength(1)
  barcode!: string;
}
