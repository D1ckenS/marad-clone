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
import { CreatePoLineDto } from './dto/create-po-line.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrderService } from './purchase-order.service';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard)
export class PurchaseOrderController {
  constructor(private readonly svc: PurchaseOrderService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreatePurchaseOrderDto) {
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
  update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }

  @Post(':id/lines')
  addLine(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: CreatePoLineDto) {
    return this.svc.addLine(auth, id, dto);
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  send(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.send(auth, id);
  }

  @Post(':id/receive')
  @HttpCode(HttpStatus.CREATED)
  receive(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    return this.svc.receive(auth, id, dto);
  }
}
