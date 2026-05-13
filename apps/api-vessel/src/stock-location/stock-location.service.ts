import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { stockLocations } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateStockLocationDto } from './dto/create-stock-location.dto';
import type { UpdateStockLocationDto } from './dto/update-stock-location.dto';

const ENTITY_TYPE = 'StockLocation';

@Injectable()
export class StockLocationService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateStockLocationDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.drizzle.db.transaction((tx) => {
      const fields = { name: dto.name, description: dto.description ?? null, vesselId };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .insert(stockLocations)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          name: dto.name,
          description: dto.description ?? null,
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
      .from(stockLocations)
      .where(
        and(
          eq(stockLocations.tenantId, auth.tenantId),
          eq(stockLocations.vesselId, vesselId),
          isNull(stockLocations.deletedAt),
        ),
      )
      .orderBy(stockLocations.name)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = this.drizzle.db
      .select()
      .from(stockLocations)
      .where(
        and(
          eq(stockLocations.id, id),
          eq(stockLocations.tenantId, auth.tenantId),
          eq(stockLocations.vesselId, vesselId),
          isNull(stockLocations.deletedAt),
        ),
      )
      .get();
    if (row === undefined) throw new NotFoundException(`StockLocation ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateStockLocationDto) {
    const vesselId = requireVesselId(auth);
    this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.name !== undefined) fields['name'] = dto.name;
    if (dto.description !== undefined) fields['description'] = dto.description;
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .update(stockLocations)
        .set({
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          hlc,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(stockLocations.id, id))
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
      tx.update(stockLocations)
        .set({ deletedAt: new Date().toISOString(), hlc, updatedAt: new Date().toISOString() })
        .where(eq(stockLocations.id, id))
        .run();
    });
  }
}
