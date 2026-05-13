import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateRequisitionDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  totalAmount?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  approvalFlowId?: string;

  @IsDateString()
  requestedAt!: string;
}
