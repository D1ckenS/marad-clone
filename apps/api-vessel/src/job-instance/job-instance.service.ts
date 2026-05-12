import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@marad-clone/domain';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { jobInstances } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateJobInstanceDto } from './dto/create-job-instance.dto';
import type { UpdateJobInstanceDto } from './dto/update-job-instance.dto';

const ENTITY_TYPE = 'JobInstance';

@Injectable()
export class JobInstanceService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateJobInstanceDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();

    return this.drizzle.db.transaction((tx) => {
      const fields = {
        jobId: dto.jobId,
        componentId: dto.componentId,
        status: dto.status ?? 'PENDING',
        dueAt: dto.dueAt ?? null,
        dueAtRunningHours: dto.dueAtRunningHours ?? null,
        assignedToUserId: dto.assignedToUserId ?? null,
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
        .insert(jobInstances)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          jobId: dto.jobId,
          componentId: dto.componentId,
          status: dto.status ?? 'PENDING',
          dueAt: dto.dueAt ?? null,
          dueAtRunningHours: dto.dueAtRunningHours ?? null,
          assignedToUserId: dto.assignedToUserId ?? null,
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
      .from(jobInstances)
      .where(
        and(
          eq(jobInstances.tenantId, auth.tenantId),
          eq(jobInstances.vesselId, vesselId),
          isNull(jobInstances.deletedAt),
        ),
      )
      .orderBy(jobInstances.dueAt)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = this.drizzle.db
      .select()
      .from(jobInstances)
      .where(
        and(
          eq(jobInstances.id, id),
          eq(jobInstances.tenantId, auth.tenantId),
          eq(jobInstances.vesselId, vesselId),
          isNull(jobInstances.deletedAt),
        ),
      )
      .get();
    if (row === undefined) throw new NotFoundException(`JobInstance ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateJobInstanceDto) {
    const vesselId = requireVesselId(auth);
    this.findOne(auth, id);

    const fields: Record<string, unknown> = {};
    if (dto.status !== undefined) fields['status'] = dto.status;
    if (dto.dueAt !== undefined) fields['dueAt'] = dto.dueAt;
    if (dto.dueAtRunningHours !== undefined) fields['dueAtRunningHours'] = dto.dueAtRunningHours;
    if (dto.assignedToUserId !== undefined) fields['assignedToUserId'] = dto.assignedToUserId;

    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .update(jobInstances)
        .set({
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.dueAt !== undefined && { dueAt: dto.dueAt }),
          ...(dto.dueAtRunningHours !== undefined && { dueAtRunningHours: dto.dueAtRunningHours }),
          ...(dto.assignedToUserId !== undefined && { assignedToUserId: dto.assignedToUserId }),
          hlc,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(jobInstances.id, id))
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
      tx.update(jobInstances)
        .set({ deletedAt: new Date().toISOString(), hlc, updatedAt: new Date().toISOString() })
        .where(eq(jobInstances.id, id))
        .run();
    });
  }
}
