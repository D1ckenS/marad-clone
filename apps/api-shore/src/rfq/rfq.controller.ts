import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { UpdateRfqDto } from './dto/update-rfq.dto';
import { RfqService } from './rfq.service';

@Controller('rfqs')
@UseGuards(JwtAuthGuard)
export class RfqController {
  constructor(private readonly svc: RfqService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateRfqDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext) {
    return this.svc.findAll(auth);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateRfqDto) {
    return this.svc.update(auth, id, dto);
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  send(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.send(auth, id);
  }

  @Get(':id/compare')
  compare(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.compare(auth, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
