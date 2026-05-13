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
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { CreateRequisitionLineDto } from './dto/create-requisition-line.dto';
import { RejectRequisitionDto } from './dto/reject-requisition.dto';
import { UpdateRequisitionDto } from './dto/update-requisition.dto';
import { RequisitionService } from './requisition.service';

@Controller('requisitions')
@UseGuards(JwtAuthGuard)
export class RequisitionController {
  constructor(private readonly svc: RequisitionService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateRequisitionDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext, @Query('status') status?: string) {
    return this.svc.findAll(auth, status);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateRequisitionDto) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }

  @Post(':id/lines')
  addLine(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: CreateRequisitionLineDto,
  ) {
    return this.svc.addLine(auth, id, dto);
  }

  @Delete(':id/lines/:lineId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLine(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.svc.removeLine(auth, id, lineId);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.submit(auth, id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.approve(auth, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: RejectRequisitionDto) {
    return this.svc.reject(auth, id, dto);
  }
}
