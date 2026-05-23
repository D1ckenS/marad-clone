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
import { AuditService } from './audit.service';
import { CreateAuditDto, UpdateAuditDto } from './dto/audit.dto';

@Controller('audits')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateAuditDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(
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

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateAuditDto) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
