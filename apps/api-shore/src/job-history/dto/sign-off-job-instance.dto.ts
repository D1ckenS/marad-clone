import { IsOptional, IsString } from 'class-validator';

/**
 * Multipart-friendly sign-off payload. All fields are strings because they
 * arrive as text fields alongside the `photos[]` files; numeric and JSON
 * fields are parsed in the service.
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

  /**
   * JSON-encoded array describing parts consumed for this sign-off. The
   * actual link to the inventory `Part` model lands in P1-10 — for now
   * we accept a free-shape array (e.g. `[{partId, qty, unit}]`) and store
   * it verbatim in `JobHistory.partsConsumed`.
   */
  @IsOptional()
  @IsString()
  partsConsumedJson?: string;
}
