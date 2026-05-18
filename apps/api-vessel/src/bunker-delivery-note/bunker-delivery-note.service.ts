import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { bunkerDeliveryNotes } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateBdnDto, UpdateBdnDto } from './dto/create-bdn.dto';

const ENTITY = 'BunkerDeliveryNote';

@Injectable()
export class BunkerDeliveryNoteService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateBdnDto) {
    const vesselId = dto.vesselId ?? requireVesselId(auth);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        fuelProductId: dto.fuelProductId ?? null,
        bdnNumber: dto.bdnNumber ?? null,
        deliveryDate: dto.deliveryDate,
        port: dto.port ?? null,
        supplierName: dto.supplierName ?? null,
        quantityMt: dto.quantityMt,
        densityKgM3: dto.densityKgM3 ?? null,
        sulphurPct: dto.sulphurPct ?? null,
        grade: dto.grade ?? null,
        viscosity: dto.viscosity ?? null,
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
        .insert(bunkerDeliveryNotes)
        .values({
          id,
          tenantId: auth.tenantId,
          ...fields,
          createdAt: nowIso,
          updatedAt: nowIso,
          hlc,
        })
        .returning()
        .all();
      return row;
    });
  }

  findAll(auth: AuthContext, query: { vesselId?: string; from?: string; to?: string }) {
    const filters = [
      eq(bunkerDeliveryNotes.tenantId, auth.tenantId),
      isNull(bunkerDeliveryNotes.deletedAt),
    ];
    if (query.vesselId) filters.push(eq(bunkerDeliveryNotes.vesselId, query.vesselId));
    if (query.from) filters.push(gte(bunkerDeliveryNotes.deliveryDate, query.from));
    if (query.to) filters.push(lte(bunkerDeliveryNotes.deliveryDate, query.to));
    return this.drizzle.db
      .select()
      .from(bunkerDeliveryNotes)
      .where(and(...filters))
      .orderBy(desc(bunkerDeliveryNotes.deliveryDate))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(bunkerDeliveryNotes)
      .where(
        and(
          eq(bunkerDeliveryNotes.id, id),
          eq(bunkerDeliveryNotes.tenantId, auth.tenantId),
          isNull(bunkerDeliveryNotes.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`BunkerDeliveryNote ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateBdnDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.bdnNumber !== undefined) fields['bdnNumber'] = dto.bdnNumber;
    if (dto.quantityMt !== undefined) fields['quantityMt'] = dto.quantityMt;
    if (dto.densityKgM3 !== undefined) fields['densityKgM3'] = dto.densityKgM3 ?? null;
    if (dto.sulphurPct !== undefined) fields['sulphurPct'] = dto.sulphurPct ?? null;
    if (dto.grade !== undefined) fields['grade'] = dto.grade;
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
        .update(bunkerDeliveryNotes)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(bunkerDeliveryNotes.id, id))
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
      tx.update(bunkerDeliveryNotes)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(bunkerDeliveryNotes.id, id))
        .run();
    });
  }
}
