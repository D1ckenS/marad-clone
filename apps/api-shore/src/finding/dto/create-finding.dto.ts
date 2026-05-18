import { IsOptional, IsString } from 'class-validator';

export class CreateFindingDto {
  @IsString() vesselId!: string;
  @IsString() kind!: string;
  @IsString() title!: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() raisedByUserId?: string;
  @IsString() raisedAt!: string;
}

export class UpdateFindingDto {
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() description?: string;
}
