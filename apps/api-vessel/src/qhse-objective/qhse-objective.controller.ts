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
import { QhseObjectiveService } from './qhse-objective.service';
import { CreateQhseObjectiveDto, UpdateQhseObjectiveDto } from './dto/qhse-objective.dto';

@Controller('qhse-objectives')
@UseGuards(JwtAuthGuard)
export class QhseObjectiveController {
  constructor(private readonly svc: QhseObjectiveService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateQhseObjectiveDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext, @Query('category') category?: string) {
    return this.svc.findAll(auth, { ...(category !== undefined && { category }) });
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateQhseObjectiveDto,
  ) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
