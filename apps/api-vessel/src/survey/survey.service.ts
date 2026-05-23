import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { surveys } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateSurveyDto, UpdateSurveyDto } from './dto/survey.dto';

const ENTITY = 'Survey';

@Injectable()
export class SurveyService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateSurveyDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const syncFields = {
        vesselId: dto.vesselId,
        scheduledAt: dto.scheduledAt,
        kind: dto.kind,
        scope: dto.scope,
        surveyor: dto.surveyor,
        location: dto.location,
        status: dto.status ?? 'SCHEDULED',
        certificateId: dto.certificateId ?? null,
        notes: dto.notes ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: dto.vesselId },
        ENTITY,
        id,
        syncFields,
      );
      const [row] = tx
        .insert(surveys)
        .values({
          id,
          tenantId: auth.tenantId!,
          ...syncFields,
          createdAt: nowIso,
          updatedAt: nowIso,
          hlc,
        })
        .returning()
        .all();
      return row;
    });
  }

  findAll(auth: AuthContext, query: { vesselId?: string; status?: string }) {
    const filters = [eq(surveys.tenantId, auth.tenantId!), isNull(surveys.deletedAt)];
    if (query.vesselId) filters.push(eq(surveys.vesselId, query.vesselId));
    if (query.status) filters.push(eq(surveys.status, query.status as never));
    return this.drizzle.db
      .select()
      .from(surveys)
      .where(and(...filters))
      .orderBy(asc(surveys.scheduledAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(surveys)
      .where(
        and(eq(surveys.id, id), eq(surveys.tenantId, auth.tenantId!), isNull(surveys.deletedAt)),
      )
      .get();
    if (!row) throw new NotFoundException(`Survey ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateSurveyDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.scheduledAt !== undefined) fields['scheduledAt'] = dto.scheduledAt;
    if (dto.kind !== undefined) fields['kind'] = dto.kind;
    if (dto.scope !== undefined) fields['scope'] = dto.scope;
    if (dto.surveyor !== undefined) fields['surveyor'] = dto.surveyor;
    if (dto.location !== undefined) fields['location'] = dto.location;
    if (dto.status !== undefined) fields['status'] = dto.status;
    if (dto.certificateId !== undefined) fields['certificateId'] = dto.certificateId;
    if (dto.notes !== undefined) fields['notes'] = dto.notes;

    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(surveys)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(surveys.id, id))
        .returning()
        .all();
      return row;
    });
  }

  softDelete(auth: AuthContext, id: string) {
    const existing = this.findOne(auth, id);
    this.drizzle.db.transaction((tx) => {
      this.recorder.recordDelete(
        tx,
        { tenantId: auth.tenantId!, vesselId: existing.vesselId },
        ENTITY,
        id,
      );
      tx.update(surveys)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(surveys.id, id))
        .run();
    });
  }
}
