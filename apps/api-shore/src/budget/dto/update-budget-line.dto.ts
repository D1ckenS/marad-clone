import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { BudgetCategory } from '@prisma/client';

export class UpdateBudgetLineDto {
  @IsOptional()
  @IsEnum(BudgetCategory)
  category?: BudgetCategory;

  @IsOptional()
  @IsNumberString()
  budgetedAmount?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
