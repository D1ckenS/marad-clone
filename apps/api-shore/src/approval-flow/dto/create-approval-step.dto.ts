import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateApprovalStepDto {
  @IsInt()
  stepOrder!: number;

  @IsString()
  approverRole!: string;

  @IsOptional()
  @IsString()
  limitAmount?: string;

  @IsOptional()
  @IsString()
  limitCurrency?: string;
}
