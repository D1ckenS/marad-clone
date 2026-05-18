import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateTankDto {
  @IsString() vesselId!: string;
  @IsString() name!: string;
  @IsString() tankType!: string;
  @IsString() @IsOptional() fuelProductId?: string;
  @IsNumberString() @IsOptional() capacityM3?: string;
  @IsString() @IsOptional() framePosition?: string;
}

export class UpdateTankDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() tankType?: string;
  @IsString() @IsOptional() fuelProductId?: string;
  @IsNumberString() @IsOptional() capacityM3?: string;
  @IsString() @IsOptional() framePosition?: string;
}
