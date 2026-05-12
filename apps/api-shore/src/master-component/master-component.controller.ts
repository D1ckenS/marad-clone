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
import { CreateMasterComponentDto } from './dto/create-master-component.dto';
import { UpdateMasterComponentDto } from './dto/update-master-component.dto';
import { MasterComponentService } from './master-component.service';

@Controller('master-components')
@UseGuards(JwtAuthGuard)
export class MasterComponentController {
  constructor(private readonly masters: MasterComponentService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateMasterComponentDto) {
    return this.masters.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext) {
    return this.masters.findAll(auth);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.masters.findOne(auth, id);
  }

  @Patch(':id')
  update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateMasterComponentDto,
  ) {
    return this.masters.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.masters.softDelete(auth, id);
  }
}
