import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateTankReadingDto {
  @IsString() vesselId!: string;
  @IsString() tankId!: string;
  @IsString() readingDate!: string;
  @IsNumberString() robMt!: string;
  @IsNumberString() @IsOptional() robM3?: string;
  @IsNumberString() @IsOptional() trim?: string;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() recordedByUserId?: string;
}

export class UpdateTankReadingDto {
  @IsNumberString() @IsOptional() robMt?: string;
  @IsNumberString() @IsOptional() robM3?: string;
  @IsString() @IsOptional() notes?: string;
}
