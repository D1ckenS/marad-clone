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
import { CreateJobInstanceDto } from './dto/create-job-instance.dto';
import { UpdateJobInstanceDto } from './dto/update-job-instance.dto';
import { JobInstanceService } from './job-instance.service';

@Controller('job-instances')
@UseGuards(JwtAuthGuard)
export class JobInstanceController {
  constructor(private readonly instances: JobInstanceService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateJobInstanceDto) {
    return this.instances.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext) {
    return this.instances.findAll(auth);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.instances.findOne(auth, id);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateJobInstanceDto) {
    return this.instances.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.instances.softDelete(auth, id);
  }
}
