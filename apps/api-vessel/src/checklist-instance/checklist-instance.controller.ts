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
import { ChecklistInstanceService } from './checklist-instance.service';
import {
  CreateChecklistInstanceDto,
  SignChecklistItemDto,
  UpdateChecklistInstanceDto,
} from './dto/create-checklist-instance.dto';

@Controller('checklist-instances')
@UseGuards(JwtAuthGuard)
export class ChecklistInstanceController {
  constructor(private readonly svc: ChecklistInstanceService) {}

  @Post() create(@AuthCtx() auth: AuthContext, @Body() dto: CreateChecklistInstanceDto) {
    return this.svc.create(auth, dto);
  }
  @Get() findAll(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(vesselId !== undefined && { vesselId }),
      ...(status !== undefined && { status }),
    });
  }
  @Get(':id') findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }
  @Patch(':id') update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateChecklistInstanceDto,
  ) {
    return this.svc.update(auth, id, dto);
  }
  @Delete(':id') @HttpCode(204) remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
  @Post(':id/sign-item') signItem(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: SignChecklistItemDto,
  ) {
    return this.svc.signItem(auth, id, dto);
  }
  @Post(':id/complete') complete(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.complete(auth, id);
  }
}
