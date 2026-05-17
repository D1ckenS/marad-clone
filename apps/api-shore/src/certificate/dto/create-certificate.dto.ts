import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export type CertSubjectType = 'VESSEL' | 'COMPONENT' | 'CREW_MEMBER';

export class CreateCertificateDto {
  @IsString()
  certificateTypeId!: string;

  @IsEnum(['VESSEL', 'COMPONENT', 'CREW_MEMBER'])
  subjectType!: CertSubjectType;

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
