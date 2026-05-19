import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { BudgetCategory } from '@prisma/client';

export class CreateBudgetLineDto {
  @IsEnum(BudgetCategory)
  category!: BudgetCategory;

  @IsNumberString()
  budgetedAmount!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
