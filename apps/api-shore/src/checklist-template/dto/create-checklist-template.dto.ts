import { IsOptional, IsString } from 'class-validator';

export class CreateChecklistTemplateDto {
  @IsString() title!: string;
  @IsString() @IsOptional() description?: string;
  @IsString() itemsJson!: string;
}

export class UpdateChecklistTemplateDto {
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() itemsJson?: string;
}
