import { IsOptional, IsString } from 'class-validator';

export class CreateChecklistInstanceDto {
  @IsString() vesselId!: string;
  @IsString() title!: string;
  @IsString() @IsOptional() templateId?: string;
  @IsString() @IsOptional() responsesJson?: string;
}

export class UpdateChecklistInstanceDto {
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() responsesJson?: string;
}

export class SignChecklistItemDto {
  @IsString() itemId!: string;
  @IsString() signedByUserId!: string;
  @IsString() signedAt!: string;
  @IsString() @IsOptional() signatureKey?: string;
  @IsOptional() checked?: boolean;
}
