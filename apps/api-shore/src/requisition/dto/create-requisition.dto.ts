import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateRequisitionDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // totalAmount is derived from SUM(requisition_lines.totalPrice).
  // See RequisitionService.recomputeTotal — clients can't set it.

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  approvalFlowId?: string;

  @IsDateString()
  requestedAt!: string;
}
