import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateRequisitionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // totalAmount is derived; see CreateRequisitionDto.

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  approvalFlowId?: string;

  @IsOptional()
  @IsDateString()
  requestedAt?: string;
}
