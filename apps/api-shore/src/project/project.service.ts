import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxRecorder } from '../sync/outbox-recorder';
import { Prisma } from '@prisma/client';
import type { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import type { CreateProjectTaskDto, UpdateProjectTaskDto } from './dto/create-project-task.dto';

const PROJECT_ENTITY = 'Project';
const TASK_ENTITY = 'ProjectTask';

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: OutboxRecorder,
  ) {}

  async createProject(auth: AuthContext, dto: CreateProjectDto) {
    const id = newId();
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const fields = { vesselId: dto.vesselId, title: dto.title, status: dto.status ?? 'PLANNING' };
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId!, vesselId: dto.vesselId },
        PROJECT_ENTITY,
        id,
        fields,
      );
      return tx.project.create({
        data: {
          id,
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          title: dto.title,
          description: dto.description ?? null,
          status: (dto.status ?? 'PLANNING') as never,
          startDate: dto.startDate ?? null,
          endDate: dto.endDate ?? null,
          hlc,
        },
        include: { tasks: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } },
      });
    });
  }

  findAllProjects(auth: AuthContext, vesselId?: string) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.project.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(vesselId && { vesselId }),
        },
        include: { tasks: { where: { deletedAt: null }, orderBy: { startDate: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOneProject(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.project.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
        include: { tasks: { where: { deletedAt: null }, orderBy: { startDate: 'asc' } } },
      }),
    );
    if (!row) throw new NotFoundException(`Project ${id} not found`);
    return row;
  }

  async updateProject(auth: AuthContext, id: string, dto: UpdateProjectDto) {
    await this.findOneProject(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.project.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.status !== undefined && { status: dto.status as never }),
          ...(dto.startDate !== undefined && { startDate: dto.startDate }),
          ...(dto.endDate !== undefined && { endDate: dto.endDate }),
        },
        include: { tasks: { where: { deletedAt: null }, orderBy: { startDate: 'asc' } } },
      }),
    );
  }

  async deleteProject(auth: AuthContext, id: string) {
    await this.findOneProject(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.project.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  async createTask(auth: AuthContext, projectId: string, dto: CreateProjectTaskDto) {
    const project = await this.findOneProject(auth, projectId);
    const id = newId();
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const fields = { vesselId: project.vesselId, projectId, title: dto.title };
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId!, vesselId: project.vesselId },
        TASK_ENTITY,
        id,
        fields,
      );
      return tx.projectTask.create({
        data: {
          id,
          tenantId: auth.tenantId!,
          vesselId: project.vesselId,
          projectId,
          title: dto.title,
          description: dto.description ?? null,
          status: (dto.status ?? 'TODO') as never,
          startDate: dto.startDate ?? null,
          endDate: dto.endDate ?? null,
          plannedDays: dto.plannedDays ?? null,
          predecessorId: dto.predecessorId ?? null,
          assignedToRole: dto.assignedToRole ?? null,
          hlc,
        },
      });
    });
  }

  async findProjectTasks(auth: AuthContext, projectId: string) {
    await this.findOneProject(auth, projectId);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.projectTask.findMany({
        where: { projectId, tenantId: auth.tenantId!, deletedAt: null },
        orderBy: { startDate: 'asc' },
      }),
    );
  }

  async updateTask(
    auth: AuthContext,
    projectId: string,
    taskId: string,
    dto: UpdateProjectTaskDto,
  ) {
    await this.findOneProject(auth, projectId);
    const existing = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.projectTask.findFirst({
        where: { id: taskId, projectId, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!existing) throw new NotFoundException(`Task ${taskId} not found`);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.projectTask.update({
        where: { id: taskId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.status !== undefined && { status: dto.status as never }),
          ...(dto.startDate !== undefined && { startDate: dto.startDate }),
          ...(dto.endDate !== undefined && { endDate: dto.endDate }),
          ...(dto.plannedDays !== undefined && { plannedDays: dto.plannedDays }),
          ...(dto.predecessorId !== undefined && { predecessorId: dto.predecessorId }),
          ...(dto.assignedToRole !== undefined && { assignedToRole: dto.assignedToRole }),
        },
      }),
    );
  }

  async deleteTask(auth: AuthContext, projectId: string, taskId: string) {
    await this.findOneProject(auth, projectId);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.projectTask.updateMany({
        where: { id: taskId, projectId, tenantId: auth.tenantId! },
        data: { deletedAt: new Date() },
      }),
    );
  }
}
