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
import { ManagementReviewService } from './management-review.service';
import { CreateManagementReviewDto, UpdateManagementReviewDto } from './dto/management-review.dto';

@Controller('management-reviews')
@UseGuards(JwtAuthGuard)
export class ManagementReviewController {
  constructor(private readonly svc: ManagementReviewService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateManagementReviewDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext, @Query('status') status?: string) {
    return this.svc.findAll(auth, { ...(status !== undefined && { status }) });
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateManagementReviewDto,
  ) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
