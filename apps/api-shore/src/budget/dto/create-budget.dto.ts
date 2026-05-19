import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateBudgetDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(2000)
  year!: number;

  @IsOptional()
  @IsString()
  vesselId?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}
