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
import { DrybmsElementService } from './drybms-element.service';
import { CreateDrybmsElementDto, UpdateDrybmsElementDto } from './dto/drybms-element.dto';

@Controller('drybms-elements')
@UseGuards(JwtAuthGuard)
export class DrybmsElementController {
  constructor(private readonly svc: DrybmsElementService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateDrybmsElementDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext, @Query('chapter') chapter?: string) {
    return this.svc.findAll(auth, { ...(chapter !== undefined && { chapter }) });
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateDrybmsElementDto,
  ) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
