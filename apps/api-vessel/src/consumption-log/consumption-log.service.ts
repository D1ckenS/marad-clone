import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { consumptionLogs } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type {
  CreateConsumptionLogDto,
  UpdateConsumptionLogDto,
} from './dto/create-consumption-log.dto';

const ENTITY = 'ConsumptionLog';

@Injectable()
export class ConsumptionLogService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateConsumptionLogDto) {
    const vesselId = dto.vesselId ?? requireVesselId(auth);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        fuelProductId: dto.fuelProductId ?? null,
        logDate: dto.logDate,
        consumerType: dto.consumerType,
        consumerName: dto.consumerName ?? null,
        consumptionMt: dto.consumptionMt,
        voyageLeg: dto.voyageLeg ?? null,
        notes: dto.notes ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(consumptionLogs)
        .values({
          id,
          tenantId: auth.tenantId,
          ...fields,
          createdAt: nowIso,
          updatedAt: nowIso,
          hlc,
        } as never)
        .returning()
        .all();
      return row;
    });
  }

  findAll(
    auth: AuthContext,
    query: { vesselId?: string; from?: string; to?: string; consumerType?: string },
  ) {
    const filters = [
      eq(consumptionLogs.tenantId, auth.tenantId),
      isNull(consumptionLogs.deletedAt),
    ];
    if (query.vesselId) filters.push(eq(consumptionLogs.vesselId, query.vesselId));
    if (query.consumerType)
      filters.push(eq(consumptionLogs.consumerType, query.consumerType as never));
    if (query.from) filters.push(gte(consumptionLogs.logDate, query.from));
    if (query.to) filters.push(lte(consumptionLogs.logDate, query.to));
    return this.drizzle.db
      .select()
      .from(consumptionLogs)
      .where(and(...filters))
      .orderBy(desc(consumptionLogs.logDate))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(consumptionLogs)
      .where(
        and(
          eq(consumptionLogs.id, id),
          eq(consumptionLogs.tenantId, auth.tenantId),
          isNull(consumptionLogs.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`ConsumptionLog ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateConsumptionLogDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.consumptionMt !== undefined) fields['consumptionMt'] = dto.consumptionMt;
    if (dto.voyageLeg !== undefined) fields['voyageLeg'] = dto.voyageLeg;
    if (dto.notes !== undefined) fields['notes'] = dto.notes;
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(consumptionLogs)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(consumptionLogs.id, id))
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
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        ENTITY,
        id,
      );
      tx.update(consumptionLogs)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(consumptionLogs.id, id))
        .run();
    });
  }
}
