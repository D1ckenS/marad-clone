import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FindingService } from './finding.service';
import { CreateFindingDto, UpdateFindingDto } from './dto/create-finding.dto';

@Controller('findings')
@UseGuards(JwtAuthGuard)
export class FindingController {
  constructor(private readonly svc: FindingService) {}

  @Post() create(@AuthCtx() auth: AuthContext, @Body() dto: CreateFindingDto) {
    return this.svc.create(auth, dto);
  }
  @Get() findAll(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(vesselId !== undefined && { vesselId }),
      ...(kind !== undefined && { kind }),
      ...(status !== undefined && { status }),
    });
  }
  @Get(':id') findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }
  @Patch(':id') update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateFindingDto,
  ) {
    return this.svc.update(auth, id, dto);
  }
  @Delete(':id') @HttpCode(204) remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
  @Post(':id/close') close(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.close(auth, id);
  }
}
