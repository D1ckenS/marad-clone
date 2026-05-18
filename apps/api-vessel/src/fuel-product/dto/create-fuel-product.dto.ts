import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateFuelProductDto {
  @IsString() name!: string;
  @IsString() tankType!: string;
  @IsNumberString() @IsOptional() sulphurPct?: string;
  @IsNumberString() @IsOptional() densityKgM3?: string;
}

export class UpdateFuelProductDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() tankType?: string;
  @IsNumberString() @IsOptional() sulphurPct?: string;
  @IsNumberString() @IsOptional() densityKgM3?: string;
}
