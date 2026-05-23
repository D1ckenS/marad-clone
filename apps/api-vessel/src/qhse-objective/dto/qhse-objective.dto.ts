import { IsArray, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

const CATEGORIES = ['Q', 'H', 'S', 'E'] as const;
const STATUSES = ['GREEN', 'AMBER', 'RED'] as const;
export type QhseObjectiveCategoryLiteral = (typeof CATEGORIES)[number];
export type QhseObjectiveStatusLiteral = (typeof STATUSES)[number];

export class CreateQhseObjectiveDto {
  @IsIn(CATEGORIES as unknown as string[])
  category!: QhseObjectiveCategoryLiteral;

  @IsString()
  label!: string;

  @IsString()
  target!: string;

  @IsString()
  actual!: string;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsIn(STATUSES as unknown as string[])
  status?: QhseObjectiveStatusLiteral;

  @IsOptional()
  @IsString()
  delta?: string;

  @IsOptional()
  @IsArray()
  trend?: number[];

  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @IsOptional()
  @IsDateString()
  periodTo?: string;
}

export class UpdateQhseObjectiveDto {
  @IsOptional()
  @IsIn(CATEGORIES as unknown as string[])
  category?: QhseObjectiveCategoryLiteral;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  target?: string;

  @IsOptional()
  @IsString()
  actual?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsIn(STATUSES as unknown as string[])
  status?: QhseObjectiveStatusLiteral;

  @IsOptional()
  @IsString()
  delta?: string | null;

  @IsOptional()
  @IsArray()
  trend?: number[] | null;

  @IsOptional()
  @IsDateString()
  periodFrom?: string | null;

  @IsOptional()
  @IsDateString()
  periodTo?: string | null;
}
