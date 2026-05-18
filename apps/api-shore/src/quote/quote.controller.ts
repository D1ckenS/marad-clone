import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { CreateQuoteLineDto } from './dto/create-quote-line.dto';
import { QuoteService } from './quote.service';

@Controller('quotes')
@UseGuards(JwtAuthGuard)
export class QuoteController {
  constructor(private readonly svc: QuoteService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateQuoteDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext, @Query('rfqId') rfqId?: string) {
    return this.svc.findAll(auth, rfqId);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Post(':id/lines')
  addLine(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: CreateQuoteLineDto) {
    return this.svc.addLine(auth, id, dto);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  accept(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.accept(auth, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  rejectQuote(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.reject(auth, id);
  }

  @Post(':id/convert-to-po')
  @HttpCode(HttpStatus.CREATED)
  convertToPo(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.convertToPo(auth, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
