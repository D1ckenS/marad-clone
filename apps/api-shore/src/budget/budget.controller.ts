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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { BudgetService } from './budget.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { CreateBudgetLineDto } from './dto/create-budget-line.dto';
import { UpdateBudgetLineDto } from './dto/update-budget-line.dto';

@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetController {
  constructor(private readonly svc: BudgetService) {}

  @Get()
  findAll(
    @AuthCtx() auth: AuthContext,
    @Query('year') year?: string,
    @Query('vesselId') vesselId?: string,
  ) {
    return this.svc.findAll(auth, year ? parseInt(year, 10) : undefined, vesselId);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateBudgetDto) {
    return this.svc.create(auth, dto);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateBudgetDto) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.remove(auth, id);
  }

  // ── Lines ──────────────────────────────────────────────────────────────────

  @Post(':id/lines')
  addLine(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: CreateBudgetLineDto) {
    return this.svc.addLine(auth, id, dto);
  }

  @Patch(':id/lines/:lineId')
  updateLine(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateBudgetLineDto,
  ) {
    return this.svc.updateLine(auth, id, lineId, dto);
  }

  @Delete(':id/lines/:lineId')
  @HttpCode(204)
  removeLine(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.svc.removeLine(auth, id, lineId);
  }
}
