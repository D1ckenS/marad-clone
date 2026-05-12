import { IsOptional, IsString } from 'class-validator';

/**
 * Multipart-friendly sign-off payload. Mirrors the shore DTO — all fields
 * arrive as text fields alongside the `photos[]` files.
 */
export class SignOffJobInstanceDto {
  @IsOptional()
  @IsString()
  hoursWorked?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  signatureHash?: string;

  /** JSON-encoded array; stored verbatim in `job_histories.parts_consumed`. */
  @IsOptional()
  @IsString()
  partsConsumedJson?: string;
}
