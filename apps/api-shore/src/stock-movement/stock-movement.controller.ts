import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StockMovementService } from './stock-movement.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Controller('stock-movements')
@UseGuards(JwtAuthGuard)
export class StockMovementController {
  constructor(private readonly svc: StockMovementService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateStockMovementDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(
    @AuthCtx() auth: AuthContext,
    @Query('partId') partId?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.svc.findAll(auth, partId, locationId);
  }

  @Get('rob')
  rob(@AuthCtx() auth: AuthContext) {
    return this.svc.rob(auth);
  }
}
