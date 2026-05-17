import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const PERMIT_TYPES = [
  'HOT_WORK',
  'CONFINED_SPACE',
  'WORKING_AT_HEIGHT',
  'ELECTRICAL_ISOLATION',
  'COLD_WORK',
  'DIVING',
  'OVERSIDE_WORK',
] as const;

export class CreatePermitTemplateDto {
  @IsIn(PERMIT_TYPES)
  permitType!: (typeof PERMIT_TYPES)[number];

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  checklistItemsJson?: string;
}

export class UpdatePermitTemplateDto {
  @IsOptional()
  @IsIn(PERMIT_TYPES)
  permitType?: (typeof PERMIT_TYPES)[number];

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  checklistItemsJson?: string;
}
