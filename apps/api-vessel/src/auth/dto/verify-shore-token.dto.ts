import { IsString, MinLength } from 'class-validator';

export class VerifyShoreTokenDto {
  @IsString()
  @MinLength(1)
  access_token!: string;
}
