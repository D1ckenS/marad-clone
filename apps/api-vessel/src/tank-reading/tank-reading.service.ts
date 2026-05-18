import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { tankReadings } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateTankReadingDto, UpdateTankReadingDto } from './dto/create-tank-reading.dto';

const ENTITY = 'TankReading';

@Injectable()
export class TankReadingService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateTankReadingDto) {
    const vesselId = dto.vesselId ?? requireVesselId(auth);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        tankId: dto.tankId,
        readingDate: dto.readingDate,
        robMt: dto.robMt,
        robM3: dto.robM3 ?? null,
        trim: dto.trim ?? null,
        notes: dto.notes ?? null,
        recordedByUserId: dto.recordedByUserId ?? auth.userId,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(tankReadings)
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
    query: { vesselId?: string; tankId?: string; from?: string; to?: string },
  ) {
    const filters = [eq(tankReadings.tenantId, auth.tenantId), isNull(tankReadings.deletedAt)];
    if (query.vesselId) filters.push(eq(tankReadings.vesselId, query.vesselId));
    if (query.tankId) filters.push(eq(tankReadings.tankId, query.tankId));
    if (query.from) filters.push(gte(tankReadings.readingDate, query.from));
    if (query.to) filters.push(lte(tankReadings.readingDate, query.to));
    return this.drizzle.db
      .select()
      .from(tankReadings)
      .where(and(...filters))
      .orderBy(desc(tankReadings.readingDate))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(tankReadings)
      .where(
        and(
          eq(tankReadings.id, id),
          eq(tankReadings.tenantId, auth.tenantId),
          isNull(tankReadings.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`TankReading ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateTankReadingDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.robMt !== undefined) fields['robMt'] = dto.robMt;
    if (dto.robM3 !== undefined) fields['robM3'] = dto.robM3 ?? null;
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
        .update(tankReadings)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(tankReadings.id, id))
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
      tx.update(tankReadings)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(tankReadings.id, id))
        .run();
    });
  }
}
