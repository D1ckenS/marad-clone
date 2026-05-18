import { IsOptional, IsString } from 'class-validator';

export class CreateRotationDto {
  @IsString() vesselId!: string;
  @IsString() crewMemberId!: string;
  @IsString() plannedSignOn!: string;
  @IsString() plannedSignOff!: string;
  @IsString() @IsOptional() notes?: string;
}

export class UpdateRotationDto {
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() plannedSignOn?: string;
  @IsString() @IsOptional() plannedSignOff?: string;
  @IsString() @IsOptional() actualSignOn?: string;
  @IsString() @IsOptional() actualSignOff?: string;
  @IsString() @IsOptional() notes?: string;
}
