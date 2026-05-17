import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateCertificateDto {
  @IsString()
  certificateTypeId!: string;

  @IsEnum(['VESSEL', 'COMPONENT', 'CREW_MEMBER'])
  subjectType!: 'VESSEL' | 'COMPONENT' | 'CREW_MEMBER';

  @IsString()
  subjectId!: string;

  @IsString()
  @IsOptional()
  vesselId?: string;

  @IsString()
  @IsOptional()
  number?: string;

  @IsDateString()
  @IsOptional()
  issuedAt?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsString()
  @IsOptional()
  issuedBy?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
