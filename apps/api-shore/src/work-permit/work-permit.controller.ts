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
import { WorkPermitService } from './work-permit.service';
import {
  AddPermitApprovalDto,
  CreateWorkPermitDto,
  UpdateWorkPermitDto,
} from './dto/create-work-permit.dto';

@Controller('work-permits')
@UseGuards(JwtAuthGuard)
export class WorkPermitController {
  constructor(private readonly svc: WorkPermitService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateWorkPermitDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(
    @AuthCtx() auth: AuthContext,
    @Query('status') status?: string,
    @Query('vesselId') vesselId?: string,
    @Query('permitType') permitType?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(status !== undefined && { status }),
      ...(vesselId !== undefined && { vesselId }),
      ...(permitType !== undefined && { permitType }),
    });
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateWorkPermitDto) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }

  @Post(':id/approve')
  approve(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.approve(auth, id);
  }

  @Post(':id/activate')
  activate(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.activate(auth, id);
  }

  @Post(':id/close')
  close(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.close(auth, id);
  }

  @Post(':id/cancel')
  cancel(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.cancel(auth, id);
  }

  @Post(':id/approvals')
  addApproval(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: AddPermitApprovalDto,
  ) {
    return this.svc.addApproval(auth, id, dto);
  }
}
