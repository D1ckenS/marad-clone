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
import { PermitTemplateService } from './permit-template.service';
import { CreatePermitTemplateDto, UpdatePermitTemplateDto } from './dto/create-permit-template.dto';

@Controller('permit-templates')
@UseGuards(JwtAuthGuard)
export class PermitTemplateController {
  constructor(private readonly svc: PermitTemplateService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreatePermitTemplateDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext, @Query('permitType') permitType?: string) {
    return this.svc.findAll(auth, permitType);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdatePermitTemplateDto,
  ) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
