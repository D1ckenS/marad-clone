import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateQhseDocumentDto {
  @IsString() title!: string;
  @IsString() @IsOptional() category?: string;
  @IsString() @IsOptional() description?: string;
  @IsBoolean() @IsOptional() isControlled?: boolean;
}

export class UpdateQhseDocumentDto {
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() category?: string;
  @IsString() @IsOptional() description?: string;
  @IsBoolean() @IsOptional() isControlled?: boolean;
}

export class CreateDocumentRevisionDto {
  @IsString() s3Key!: string;
  @IsString() @IsOptional() summary?: string;
  @IsString() @IsOptional() authoredByUserId?: string;
  @IsString() @IsOptional() approvedByUserId?: string;
  @IsString() @IsOptional() approvedAt?: string;
}
