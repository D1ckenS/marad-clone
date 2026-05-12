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
import { ComponentService } from './component.service';
import { CreateComponentDto } from './dto/create-component.dto';
import { UpdateComponentDto } from './dto/update-component.dto';

@Controller('components')
@UseGuards(JwtAuthGuard)
export class ComponentController {
  constructor(private readonly components: ComponentService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateComponentDto) {
    return this.components.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext) {
    return this.components.findAll(auth);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.components.findOne(auth, id);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateComponentDto) {
    return this.components.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.components.softDelete(auth, id);
  }
}
