import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { dischargeLogs } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateDischargeLogDto, UpdateDischargeLogDto } from './dto/discharge-log.dto';

const ENTITY = 'DischargeLog';

@Injectable()
export class DischargeLogService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateDischargeLogDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const syncFields = {
        vesselId: dto.vesselId,
        kind: dto.kind,
        occurredAt: dto.occurredAt,
        location: dto.location,
        volume: dto.volume,
        notes: dto.notes ?? null,
        compliant: dto.compliant ?? true,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: dto.vesselId },
        ENTITY,
        id,
        syncFields,
      );
      const [row] = tx
        .insert(dischargeLogs)
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

  findAll(auth: AuthContext, query: { vesselId?: string }) {
    const filters = [eq(dischargeLogs.tenantId, auth.tenantId!), isNull(dischargeLogs.deletedAt)];
    if (query.vesselId) filters.push(eq(dischargeLogs.vesselId, query.vesselId));
    return this.drizzle.db
      .select()
      .from(dischargeLogs)
      .where(and(...filters))
      .orderBy(desc(dischargeLogs.occurredAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(dischargeLogs)
      .where(
        and(
          eq(dischargeLogs.id, id),
          eq(dischargeLogs.tenantId, auth.tenantId!),
          isNull(dischargeLogs.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`DischargeLog ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateDischargeLogDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.kind !== undefined) fields['kind'] = dto.kind;
    if (dto.occurredAt !== undefined) fields['occurredAt'] = dto.occurredAt;
    if (dto.location !== undefined) fields['location'] = dto.location;
    if (dto.volume !== undefined) fields['volume'] = dto.volume;
    if (dto.notes !== undefined) fields['notes'] = dto.notes;
    if (dto.compliant !== undefined) fields['compliant'] = dto.compliant;

    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(dischargeLogs)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(dischargeLogs.id, id))
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
      tx.update(dischargeLogs)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(dischargeLogs.id, id))
        .run();
    });
  }
}
