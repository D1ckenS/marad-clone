import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateBdnDto {
  @IsString() vesselId!: string;
  @IsString() @IsOptional() fuelProductId?: string;
  @IsString() @IsOptional() bdnNumber?: string;
  @IsString() deliveryDate!: string;
  @IsString() @IsOptional() port?: string;
  @IsString() @IsOptional() supplierName?: string;
  @IsNumberString() quantityMt!: string;
  @IsNumberString() @IsOptional() densityKgM3?: string;
  @IsNumberString() @IsOptional() sulphurPct?: string;
  @IsString() @IsOptional() grade?: string;
  @IsNumberString() @IsOptional() viscosity?: string;
  @IsString() @IsOptional() notes?: string;
}

export class UpdateBdnDto {
  @IsString() @IsOptional() bdnNumber?: string;
  @IsNumberString() @IsOptional() quantityMt?: string;
  @IsNumberString() @IsOptional() densityKgM3?: string;
  @IsNumberString() @IsOptional() sulphurPct?: string;
  @IsString() @IsOptional() grade?: string;
  @IsString() @IsOptional() notes?: string;
}
