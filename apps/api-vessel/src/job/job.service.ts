import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { jobs } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateJobDto } from './dto/create-job.dto';
import type { UpdateJobDto } from './dto/update-job.dto';

const ENTITY_TYPE = 'Job';

@Injectable()
export class JobService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateJobDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();

    return this.drizzle.db.transaction((tx) => {
      const fields = {
        componentId: dto.componentId,
        title: dto.title,
        description: dto.description ?? null,
        intervalDays: dto.intervalDays ?? null,
        intervalRunningHours: dto.intervalRunningHours ?? null,
        estimatedHours: dto.estimatedHours ?? null,
        priority: dto.priority ?? 'NORMAL',
        vesselId,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .insert(jobs)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          componentId: dto.componentId,
          title: dto.title,
          description: dto.description ?? null,
          intervalDays: dto.intervalDays ?? null,
          intervalRunningHours: dto.intervalRunningHours ?? null,
          estimatedHours: dto.estimatedHours ?? null,
          priority: dto.priority ?? 'NORMAL',
          hlc,
        })
        .returning()
        .all();
      return row;
    });
  }

  findAll(auth: AuthContext) {
    const vesselId = requireVesselId(auth);
    return this.drizzle.db
      .select()
      .from(jobs)
      .where(
        and(eq(jobs.tenantId, auth.tenantId), eq(jobs.vesselId, vesselId), isNull(jobs.deletedAt)),
      )
      .orderBy(jobs.title)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = this.drizzle.db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.id, id),
          eq(jobs.tenantId, auth.tenantId),
          eq(jobs.vesselId, vesselId),
          isNull(jobs.deletedAt),
        ),
      )
      .get();
    if (row === undefined) throw new NotFoundException(`Job ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateJobDto) {
    const vesselId = requireVesselId(auth);
    this.findOne(auth, id);

    const fields: Record<string, unknown> = {};
    if (dto.title !== undefined) fields['title'] = dto.title;
    if (dto.description !== undefined) fields['description'] = dto.description;
    if (dto.intervalDays !== undefined) fields['intervalDays'] = dto.intervalDays;
    if (dto.intervalRunningHours !== undefined)
      fields['intervalRunningHours'] = dto.intervalRunningHours;
    if (dto.estimatedHours !== undefined) fields['estimatedHours'] = dto.estimatedHours;
    if (dto.priority !== undefined) fields['priority'] = dto.priority;

    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .update(jobs)
        .set({
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.intervalDays !== undefined && { intervalDays: dto.intervalDays }),
          ...(dto.intervalRunningHours !== undefined && {
            intervalRunningHours: dto.intervalRunningHours,
          }),
          ...(dto.estimatedHours !== undefined && { estimatedHours: dto.estimatedHours }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          hlc,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, id))
        .returning()
        .all();
      return row;
    });
  }

  softDelete(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    this.findOne(auth, id);
    this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordDelete(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
      );
      tx.update(jobs)
        .set({ deletedAt: new Date().toISOString(), hlc, updatedAt: new Date().toISOString() })
        .where(eq(jobs.id, id))
        .run();
    });
  }
}
