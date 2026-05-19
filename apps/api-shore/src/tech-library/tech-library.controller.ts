import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TechLibraryProvider } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { TechLibraryService } from './tech-library.service';

class UpsertTechLibraryDto {
  @IsEnum(TechLibraryProvider)
  provider!: TechLibraryProvider;

  @IsString()
  apiKey!: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  enabled?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('tech-library')
export class TechLibraryController {
  constructor(private readonly svc: TechLibraryService) {}

  @Get('config')
  getConfig(@AuthCtx() auth: AuthContext) {
    return this.svc.getConfig(auth);
  }

  @Post('config')
  upsertConfig(@AuthCtx() auth: AuthContext, @Body() dto: UpsertTechLibraryDto) {
    return this.svc.upsertConfig(auth, dto);
  }

  @Get('lookup')
  lookup(@AuthCtx() auth: AuthContext, @Query('query') query: string) {
    return this.svc.lookup(auth, query);
  }
}
