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
import { OcimfInspectionService } from './ocimf-inspection.service';
import { CreateOcimfInspectionDto } from './dto/create-ocimf-inspection.dto';

@UseGuards(JwtAuthGuard)
@Controller('ocimf-inspections')
export class OcimfInspectionController {
  constructor(private readonly svc: OcimfInspectionService) {}

  @Get()
  findAll(@AuthCtx() auth: AuthContext, @Query('vesselId') vesselId?: string) {
    return this.svc.findAll(auth, vesselId);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateOcimfInspectionDto) {
    return this.svc.create(auth, dto);
  }

  @Patch(':id')
  update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: Partial<Omit<CreateOcimfInspectionDto, 'vesselId' | 'inspectionType'>>,
  ) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.remove(auth, id);
  }
}
