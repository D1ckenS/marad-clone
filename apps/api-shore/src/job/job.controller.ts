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
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobService } from './job.service';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobController {
  constructor(private readonly jobs: JobService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateJobDto) {
    return this.jobs.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext) {
    return this.jobs.findAll(auth);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.jobs.findOne(auth, id);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.jobs.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.jobs.softDelete(auth, id);
  }
}
