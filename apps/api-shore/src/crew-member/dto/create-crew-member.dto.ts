import { IsOptional, IsString } from 'class-validator';

export class CreateCrewMemberDto {
  @IsString() vesselId!: string;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsString() rank!: string;
  @IsString() @IsOptional() nationality?: string;
  @IsString() @IsOptional() dateOfBirth?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() signOnDate?: string;
}

export class UpdateCrewMemberDto {
  @IsString() @IsOptional() firstName?: string;
  @IsString() @IsOptional() lastName?: string;
  @IsString() @IsOptional() rank?: string;
  @IsString() @IsOptional() nationality?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() signOnDate?: string;
  @IsString() @IsOptional() signOffDate?: string;
}
