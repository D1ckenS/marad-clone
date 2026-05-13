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
import { ApprovalFlowService } from './approval-flow.service';
import { CreateApprovalFlowDto } from './dto/create-approval-flow.dto';
import { CreateApprovalStepDto } from './dto/create-approval-step.dto';
import { UpdateApprovalFlowDto } from './dto/update-approval-flow.dto';

@Controller('approval-flows')
@UseGuards(JwtAuthGuard)
export class ApprovalFlowController {
  constructor(private readonly svc: ApprovalFlowService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateApprovalFlowDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext) {
    return this.svc.findAll(auth);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateApprovalFlowDto,
  ) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }

  @Post(':id/steps')
  addStep(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: CreateApprovalStepDto,
  ) {
    return this.svc.addStep(auth, id, dto);
  }

  @Delete(':id/steps/:stepId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeStep(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Param('stepId') stepId: string,
  ) {
    return this.svc.removeStep(auth, id, stepId);
  }
}
