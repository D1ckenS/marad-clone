import { IsOptional, IsString } from 'class-validator';

export class CreateCapaDto {
  @IsString() vesselId!: string;
  @IsString() @IsOptional() findingId?: string;
  @IsString() type!: string;
  @IsString() description!: string;
  @IsString() @IsOptional() ownerUserId?: string;
  @IsString() @IsOptional() dueDate?: string;
}

export class UpdateCapaDto {
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() ownerUserId?: string;
  @IsString() @IsOptional() dueDate?: string;
}
