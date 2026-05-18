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
import { ProjectService } from './project.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { CreateProjectTaskDto, UpdateProjectTaskDto } from './dto/create-project-task.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(private readonly svc: ProjectService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateProjectDto) {
    return this.svc.createProject(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext, @Query('vesselId') vesselId?: string) {
    return this.svc.findAllProjects(auth, vesselId);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOneProject(auth, id);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.svc.updateProject(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.deleteProject(auth, id);
  }

  // ── Tasks sub-resource ────────────────────────────────────────────────────

  @Post(':projectId/tasks')
  createTask(
    @AuthCtx() auth: AuthContext,
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectTaskDto,
  ) {
    return this.svc.createTask(auth, projectId, dto);
  }

  @Get(':projectId/tasks')
  findTasks(@AuthCtx() auth: AuthContext, @Param('projectId') projectId: string) {
    return this.svc.findProjectTasks(auth, projectId);
  }

  @Patch(':projectId/tasks/:taskId')
  updateTask(
    @AuthCtx() auth: AuthContext,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateProjectTaskDto,
  ) {
    return this.svc.updateTask(auth, projectId, taskId, dto);
  }

  @Delete(':projectId/tasks/:taskId')
  @HttpCode(204)
  deleteTask(
    @AuthCtx() auth: AuthContext,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.svc.deleteTask(auth, projectId, taskId);
  }
}
