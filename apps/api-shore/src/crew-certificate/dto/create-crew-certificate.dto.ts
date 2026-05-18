import { IsOptional, IsString } from 'class-validator';

export class CreateCrewCertificateDto {
  @IsString() vesselId!: string;
  @IsString() crewMemberId!: string;
  @IsString() certificateType!: string;
  @IsString() @IsOptional() number?: string;
  @IsString() @IsOptional() issuedAt?: string;
  @IsString() @IsOptional() expiresAt?: string;
  @IsString() @IsOptional() issuedBy?: string;
  @IsString() @IsOptional() notes?: string;
}

export class UpdateCrewCertificateDto {
  @IsString() @IsOptional() certificateType?: string;
  @IsString() @IsOptional() number?: string;
  @IsString() @IsOptional() issuedAt?: string;
  @IsString() @IsOptional() expiresAt?: string;
  @IsString() @IsOptional() issuedBy?: string;
  @IsString() @IsOptional() notes?: string;
}
