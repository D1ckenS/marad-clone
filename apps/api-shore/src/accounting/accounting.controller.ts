import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional } from 'class-validator';
import { AccountingProvider } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { AccountingService } from './accounting.service';

class UpsertAccountingDto {
  @IsEnum(AccountingProvider)
  provider!: AccountingProvider;

  @IsOptional()
  config?: Record<string, unknown>;

  @IsOptional()
  enabled?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly svc: AccountingService) {}

  @Get('config')
  getConfig(@AuthCtx() auth: AuthContext) {
    return this.svc.getConfig(auth);
  }

  @Post('config')
  upsertConfig(@AuthCtx() auth: AuthContext, @Body() dto: UpsertAccountingDto) {
    return this.svc.upsertConfig(auth, dto);
  }

  /** Export purchase orders as CSV, Exact Online XML, or Excel (XLSX). */
  @Get('export-pos')
  async exportPos(
    @AuthCtx() auth: AuthContext,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('format') format: string = 'csv',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Res() res: any,
  ) {
    const fmt = format === 'exact' ? 'exact' : format === 'xlsx' ? 'xlsx' : 'csv';
    const content = await this.svc.exportPos(
      auth,
      from ?? new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]!,
      to ?? new Date().toISOString().split('T')[0]!,
      fmt,
    );

    if (fmt === 'xlsx') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', 'attachment; filename="purchase-orders.xlsx"');
    } else if (fmt === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="purchase-orders.csv"');
    } else {
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', 'attachment; filename="purchase-orders-exact.xml"');
    }

    res.send(content);
  }
}
