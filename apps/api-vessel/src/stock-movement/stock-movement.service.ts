import { Injectable } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { stockMovements } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateStockMovementDto } from './dto/create-stock-movement.dto';

const ENTITY_TYPE = 'StockMovement';

export interface RobRow {
  partId: string;
  locationId: string;
  rob: string;
}

@Injectable()
export class StockMovementService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateStockMovementDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        partId: dto.partId,
        locationId: dto.locationId,
        vesselId,
        movementType: dto.movementType,
        quantity: dto.quantity,
        referenceType: dto.referenceType ?? null,
        referenceId: dto.referenceId ?? null,
        notes: dto.notes ?? null,
        recordedAt: dto.recordedAt,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .insert(stockMovements)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          partId: dto.partId,
          locationId: dto.locationId,
          movementType: dto.movementType,
          quantity: dto.quantity,
          referenceType: dto.referenceType ?? null,
          referenceId: dto.referenceId ?? null,
          notes: dto.notes ?? null,
          recordedAt: dto.recordedAt,
          hlc,
        })
        .returning()
        .all();
      return row;
    });
  }

  findAll(auth: AuthContext, partId?: string, locationId?: string) {
    const vesselId = requireVesselId(auth);
    return this.drizzle.db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.tenantId, auth.tenantId),
          eq(stockMovements.vesselId, vesselId),
          isNull(stockMovements.deletedAt),
          ...(partId ? [eq(stockMovements.partId, partId)] : []),
          ...(locationId ? [eq(stockMovements.locationId, locationId)] : []),
        ),
      )
      .orderBy(stockMovements.recordedAt)
      .all();
  }

  rob(auth: AuthContext): RobRow[] {
    const vesselId = requireVesselId(auth);
    return this.drizzle.db
      .select({
        partId: stockMovements.partId,
        locationId: stockMovements.locationId,
        rob: sql<string>`SUM(CAST(${stockMovements.quantity} AS REAL))`,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.tenantId, auth.tenantId),
          eq(stockMovements.vesselId, vesselId),
          isNull(stockMovements.deletedAt),
        ),
      )
      .groupBy(stockMovements.partId, stockMovements.locationId)
      .all()
      .map((r) => ({ partId: r.partId, locationId: r.locationId, rob: r.rob ?? '0' }));
  }
}
