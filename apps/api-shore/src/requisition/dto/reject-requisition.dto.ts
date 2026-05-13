import { IsOptional, IsString } from 'class-validator';

export class RejectRequisitionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
