import { IsOptional, IsString } from 'class-validator';

export class CreateRestHourEntryDto {
  @IsString() vesselId!: string;
  @IsString() crewMemberId!: string;
  @IsString() date!: string;
  @IsString() hoursWorkedJson!: string;
  @IsString() @IsOptional() notes?: string;
}

export class UpdateRestHourEntryDto {
  @IsString() @IsOptional() hoursWorkedJson?: string;
  @IsString() @IsOptional() notes?: string;
}
