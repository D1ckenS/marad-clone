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
import { CapaService } from './capa.service';
import { CreateCapaDto, UpdateCapaDto } from './dto/create-capa.dto';

@Controller('capas')
@UseGuards(JwtAuthGuard)
export class CapaController {
  constructor(private readonly svc: CapaService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateCapaDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('findingId') findingId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(vesselId !== undefined && { vesselId }),
      ...(findingId !== undefined && { findingId }),
      ...(status !== undefined && { status }),
    });
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateCapaDto) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }

  @Post(':id/verify')
  verify(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.verify(auth, id);
  }

  @Post(':id/close')
  close(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.close(auth, id);
  }
}
