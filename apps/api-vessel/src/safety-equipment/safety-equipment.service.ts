import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { safetyEquipment } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type {
  CreateSafetyEquipmentDto,
  UpdateSafetyEquipmentDto,
} from './dto/safety-equipment.dto';

const ENTITY = 'SafetyEquipment';

@Injectable()
export class SafetyEquipmentService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateSafetyEquipmentDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const syncFields = {
        vesselId: dto.vesselId,
        category: dto.category,
        name: dto.name,
        location: dto.location,
        quantity: dto.quantity,
        lastCheck: dto.lastCheck ?? null,
        nextCheck: dto.nextCheck ?? null,
        status: dto.status ?? 'GREEN',
        flag: dto.flag ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: dto.vesselId },
        ENTITY,
        id,
        syncFields,
      );
      const [row] = tx
        .insert(safetyEquipment)
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

  findAll(auth: AuthContext, query: { vesselId?: string; category?: string }) {
    const filters = [
      eq(safetyEquipment.tenantId, auth.tenantId!),
      isNull(safetyEquipment.deletedAt),
    ];
    if (query.vesselId) filters.push(eq(safetyEquipment.vesselId, query.vesselId));
    if (query.category) filters.push(eq(safetyEquipment.category, query.category as never));
    return this.drizzle.db
      .select()
      .from(safetyEquipment)
      .where(and(...filters))
      .orderBy(asc(safetyEquipment.category), asc(safetyEquipment.name))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(safetyEquipment)
      .where(
        and(
          eq(safetyEquipment.id, id),
          eq(safetyEquipment.tenantId, auth.tenantId!),
          isNull(safetyEquipment.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`SafetyEquipment ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateSafetyEquipmentDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.category !== undefined) fields['category'] = dto.category;
    if (dto.name !== undefined) fields['name'] = dto.name;
    if (dto.location !== undefined) fields['location'] = dto.location;
    if (dto.quantity !== undefined) fields['quantity'] = dto.quantity;
    if (dto.lastCheck !== undefined) fields['lastCheck'] = dto.lastCheck;
    if (dto.nextCheck !== undefined) fields['nextCheck'] = dto.nextCheck;
    if (dto.status !== undefined) fields['status'] = dto.status;
    if (dto.flag !== undefined) fields['flag'] = dto.flag;

    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(safetyEquipment)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(safetyEquipment.id, id))
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
      tx.update(safetyEquipment)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(safetyEquipment.id, id))
        .run();
    });
  }
}
