import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { tanks } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateTankDto, UpdateTankDto } from './dto/create-tank.dto';

const ENTITY = 'Tank';

@Injectable()
export class TankService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateTankDto) {
    const vesselId = dto.vesselId ?? requireVesselId(auth);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        name: dto.name,
        tankType: dto.tankType,
        fuelProductId: dto.fuelProductId ?? null,
        capacityM3: dto.capacityM3 ?? null,
        framePosition: dto.framePosition ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(tanks)
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

  findAll(auth: AuthContext, query: { vesselId?: string; tankType?: string }) {
    const filters = [eq(tanks.tenantId, auth.tenantId), isNull(tanks.deletedAt)];
    if (query.vesselId) filters.push(eq(tanks.vesselId, query.vesselId));
    if (query.tankType) filters.push(eq(tanks.tankType, query.tankType as never));
    return this.drizzle.db
      .select()
      .from(tanks)
      .where(and(...filters))
      .orderBy(tanks.name)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(tanks)
      .where(and(eq(tanks.id, id), eq(tanks.tenantId, auth.tenantId), isNull(tanks.deletedAt)))
      .get();
    if (!row) throw new NotFoundException(`Tank ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateTankDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.name !== undefined) fields['name'] = dto.name;
    if (dto.tankType !== undefined) fields['tankType'] = dto.tankType;
    if (dto.fuelProductId !== undefined) fields['fuelProductId'] = dto.fuelProductId;
    if (dto.capacityM3 !== undefined) fields['capacityM3'] = dto.capacityM3 ?? null;
    if (dto.framePosition !== undefined) fields['framePosition'] = dto.framePosition;
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(tanks)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(tanks.id, id))
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
      tx.update(tanks)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(tanks.id, id))
        .run();
    });
  }
}
