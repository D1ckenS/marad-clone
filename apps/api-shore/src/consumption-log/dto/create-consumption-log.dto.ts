import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateConsumptionLogDto {
  @IsString() vesselId!: string;
  @IsString() @IsOptional() fuelProductId?: string;
  @IsString() logDate!: string;
  @IsString() consumerType!: string;
  @IsString() @IsOptional() consumerName?: string;
  @IsNumberString() consumptionMt!: string;
  @IsString() @IsOptional() voyageLeg?: string;
  @IsString() @IsOptional() notes?: string;
}

export class UpdateConsumptionLogDto {
  @IsNumberString() @IsOptional() consumptionMt?: string;
  @IsString() @IsOptional() voyageLeg?: string;
  @IsString() @IsOptional() notes?: string;
}
