import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateDrybmsElementDto {
  @IsString()
  chapter!: string;

  @IsString()
  chapterTitle!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  score?: number;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsString()
  evidence?: string;
}

export class UpdateDrybmsElementDto {
  @IsOptional()
  @IsString()
  chapter?: string;

  @IsOptional()
  @IsString()
  chapterTitle?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  score?: number;

  @IsOptional()
  @IsString()
  stage?: string | null;

  @IsOptional()
  @IsString()
  evidence?: string | null;
}
