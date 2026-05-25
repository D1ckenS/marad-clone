import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

const AUDIT_KINDS = ['INTERNAL', 'EXTERNAL', 'CLASS', 'FLAG'] as const;
const AUDIT_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type AuditKindLiteral = (typeof AUDIT_KINDS)[number];
export type AuditStatusLiteral = (typeof AUDIT_STATUSES)[number];

export class CreateAuditDto {
  @IsOptional()
  @IsString()
  vesselId?: string;

  @IsIn(AUDIT_KINDS as unknown as string[])
  kind!: AuditKindLiteral;

  @IsString()
  scope!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsString()
  auditor!: string;

  @IsOptional()
  @IsIn(AUDIT_STATUSES as unknown as string[])
  status?: AuditStatusLiteral;

  // findings is derived from COUNT(audit_findings WHERE audit_id = X
  // AND deleted_at IS NULL). See AuditService.recomputeFindings.

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAuditDto {
  @IsOptional()
  @IsString()
  vesselId?: string | null;

  @IsOptional()
  @IsIn(AUDIT_KINDS as unknown as string[])
  kind?: AuditKindLiteral;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  auditor?: string;

  @IsOptional()
  @IsIn(AUDIT_STATUSES as unknown as string[])
  status?: AuditStatusLiteral;

  // findings is derived; see CreateAuditDto.

  @IsOptional()
  @IsString()
  notes?: string | null;
}
