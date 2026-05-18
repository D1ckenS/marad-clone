import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { projects, projectTasks } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import type { CreateProjectTaskDto, UpdateProjectTaskDto } from './dto/create-project-task.dto';

const PROJECT_ENTITY = 'Project';
const TASK_ENTITY = 'ProjectTask';

@Injectable()
export class ProjectService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  createProject(auth: AuthContext, dto: CreateProjectDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = { vesselId, title: dto.title, status: dto.status ?? 'PLANNING' };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        PROJECT_ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(projects)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          title: dto.title,
          description: dto.description ?? null,
          status: (dto.status ?? 'PLANNING') as never,
          startDate: dto.startDate ?? null,
          endDate: dto.endDate ?? null,
          createdAt: nowIso,
          updatedAt: nowIso,
          hlc,
        } as never)
        .returning()
        .all();
      return row;
    });
  }

  findAllProjects(auth: AuthContext, vesselIdParam?: string) {
    if (!vesselIdParam) requireVesselId(auth);
    const filters = [eq(projects.tenantId, auth.tenantId), isNull(projects.deletedAt)];
    if (vesselIdParam) filters.push(eq(projects.vesselId, vesselIdParam));
    const rows = this.drizzle.db
      .select()
      .from(projects)
      .where(and(...filters))
      .all();
    return rows.map((p) => ({
      ...p,
      tasks: this.drizzle.db
        .select()
        .from(projectTasks)
        .where(and(eq(projectTasks.projectId, p.id), isNull(projectTasks.deletedAt)))
        .orderBy(projectTasks.startDate)
        .all(),
    }));
  }

  findOneProject(auth: AuthContext, id: string) {
    const project = this.drizzle.db
      .select()
      .from(projects)
      .where(
        and(eq(projects.id, id), eq(projects.tenantId, auth.tenantId), isNull(projects.deletedAt)),
      )
      .get();
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    const tasks = this.drizzle.db
      .select()
      .from(projectTasks)
      .where(and(eq(projectTasks.projectId, id), isNull(projectTasks.deletedAt)))
      .orderBy(projectTasks.startDate)
      .all();
    return { ...project, tasks };
  }

  updateProject(auth: AuthContext, id: string, dto: UpdateProjectDto) {
    this.findOneProject(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.title !== undefined) fields['title'] = dto.title;
    if (dto.description !== undefined) fields['description'] = dto.description;
    if (dto.status !== undefined) fields['status'] = dto.status;
    if (dto.startDate !== undefined) fields['startDate'] = dto.startDate;
    if (dto.endDate !== undefined) fields['endDate'] = dto.endDate;
    this.drizzle.db
      .update(projects)
      .set({ ...fields, updatedAt: new Date().toISOString() } as never)
      .where(eq(projects.id, id))
      .run();
    return this.findOneProject(auth, id);
  }

  deleteProject(auth: AuthContext, id: string) {
    this.findOneProject(auth, id);
    this.drizzle.db
      .update(projects)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(projects.id, id))
      .run();
  }

  createTask(auth: AuthContext, projectId: string, dto: CreateProjectTaskDto) {
    const project = this.findOneProject(auth, projectId);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = { vesselId: project.vesselId, projectId, title: dto.title };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: project.vesselId },
        TASK_ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(projectTasks)
        .values({
          id,
          tenantId: auth.tenantId,
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
          createdAt: nowIso,
          updatedAt: nowIso,
          hlc,
        } as never)
        .returning()
        .all();
      return row;
    });
  }

  findProjectTasks(auth: AuthContext, projectId: string) {
    this.findOneProject(auth, projectId);
    return this.drizzle.db
      .select()
      .from(projectTasks)
      .where(and(eq(projectTasks.projectId, projectId), isNull(projectTasks.deletedAt)))
      .orderBy(projectTasks.startDate)
      .all();
  }

  updateTask(auth: AuthContext, projectId: string, taskId: string, dto: UpdateProjectTaskDto) {
    this.findOneProject(auth, projectId);
    const existing = this.drizzle.db
      .select()
      .from(projectTasks)
      .where(
        and(
          eq(projectTasks.id, taskId),
          eq(projectTasks.projectId, projectId),
          isNull(projectTasks.deletedAt),
        ),
      )
      .get();
    if (!existing) throw new NotFoundException(`Task ${taskId} not found`);
    const fields: Record<string, unknown> = {};
    if (dto.title !== undefined) fields['title'] = dto.title;
    if (dto.description !== undefined) fields['description'] = dto.description;
    if (dto.status !== undefined) fields['status'] = dto.status;
    if (dto.startDate !== undefined) fields['startDate'] = dto.startDate;
    if (dto.endDate !== undefined) fields['endDate'] = dto.endDate;
    if (dto.plannedDays !== undefined) fields['plannedDays'] = dto.plannedDays;
    if (dto.predecessorId !== undefined) fields['predecessorId'] = dto.predecessorId;
    if (dto.assignedToRole !== undefined) fields['assignedToRole'] = dto.assignedToRole;
    const [row] = this.drizzle.db
      .update(projectTasks)
      .set({ ...fields, updatedAt: new Date().toISOString() } as never)
      .where(eq(projectTasks.id, taskId))
      .returning()
      .all();
    return row;
  }

  deleteTask(auth: AuthContext, projectId: string, taskId: string) {
    this.findOneProject(auth, projectId);
    this.drizzle.db
      .update(projectTasks)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(and(eq(projectTasks.id, taskId), eq(projectTasks.projectId, projectId)))
      .run();
  }
}
