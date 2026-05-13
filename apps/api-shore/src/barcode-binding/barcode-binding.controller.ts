import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BarcodeBindingService } from './barcode-binding.service';
import { CreateBarcodeBindingDto } from './dto/create-barcode-binding.dto';

@Controller('barcode-bindings')
@UseGuards(JwtAuthGuard)
export class BarcodeBindingController {
  constructor(private readonly svc: BarcodeBindingService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateBarcodeBindingDto) {
    return this.svc.create(auth, dto);
  }

  @Get('lookup/:barcode')
  lookup(@AuthCtx() auth: AuthContext, @Param('barcode') barcode: string) {
    return this.svc.lookup(auth, barcode);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
