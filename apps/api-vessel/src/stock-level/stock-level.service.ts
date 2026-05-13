import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { stockLevels, stockLocations, parts } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateStockLevelDto } from './dto/create-stock-level.dto';
import type { UpdateStockLevelDto } from './dto/update-stock-level.dto';

const ENTITY_TYPE = 'StockLevel';

@Injectable()
export class StockLevelService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateStockLevelDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.drizzle.db.transaction((tx) => {
      const existing = tx
        .select()
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.tenantId, auth.tenantId),
            eq(stockLevels.vesselId, vesselId),
            eq(stockLevels.partId, dto.partId),
            eq(stockLevels.locationId, dto.locationId),
            isNull(stockLevels.deletedAt),
          ),
        )
        .get();
      if (existing) throw new ConflictException('StockLevel for this part+location already exists');

      const fields = {
        partId: dto.partId,
        locationId: dto.locationId,
        vesselId,
        minStock: dto.minStock ?? '0',
        maxStock: dto.maxStock ?? null,
        reorderPoint: dto.reorderPoint ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .insert(stockLevels)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          partId: dto.partId,
          locationId: dto.locationId,
          minStock: dto.minStock ?? '0',
          maxStock: dto.maxStock ?? null,
          reorderPoint: dto.reorderPoint ?? null,
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
      .select({
        id: stockLevels.id,
        tenantId: stockLevels.tenantId,
        vesselId: stockLevels.vesselId,
        partId: stockLevels.partId,
        locationId: stockLevels.locationId,
        minStock: stockLevels.minStock,
        maxStock: stockLevels.maxStock,
        reorderPoint: stockLevels.reorderPoint,
        hlc: stockLevels.hlc,
        partName: parts.name,
        locationName: stockLocations.name,
      })
      .from(stockLevels)
      .innerJoin(parts, eq(stockLevels.partId, parts.id))
      .innerJoin(stockLocations, eq(stockLevels.locationId, stockLocations.id))
      .where(
        and(
          eq(stockLevels.tenantId, auth.tenantId),
          eq(stockLevels.vesselId, vesselId),
          isNull(stockLevels.deletedAt),
        ),
      )
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = this.drizzle.db
      .select()
      .from(stockLevels)
      .where(
        and(
          eq(stockLevels.id, id),
          eq(stockLevels.tenantId, auth.tenantId),
          eq(stockLevels.vesselId, vesselId),
          isNull(stockLevels.deletedAt),
        ),
      )
      .get();
    if (row === undefined) throw new NotFoundException(`StockLevel ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateStockLevelDto) {
    const vesselId = requireVesselId(auth);
    this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.minStock !== undefined) fields['minStock'] = dto.minStock;
    if (dto.maxStock !== undefined) fields['maxStock'] = dto.maxStock;
    if (dto.reorderPoint !== undefined) fields['reorderPoint'] = dto.reorderPoint;
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .update(stockLevels)
        .set({
          ...(dto.minStock !== undefined && { minStock: dto.minStock }),
          ...(dto.maxStock !== undefined && { maxStock: dto.maxStock }),
          ...(dto.reorderPoint !== undefined && { reorderPoint: dto.reorderPoint }),
          hlc,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(stockLevels.id, id))
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
      tx.update(stockLevels)
        .set({ deletedAt: new Date().toISOString(), hlc, updatedAt: new Date().toISOString() })
        .where(eq(stockLevels.id, id))
        .run();
    });
  }
}
