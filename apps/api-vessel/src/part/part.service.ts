import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { parts, stockLevels, stockLocations, stockMovements } from '../db/schema';
import type { CreatePartDto } from './dto/create-part.dto';
import type { UpdatePartDto } from './dto/update-part.dto';

export type StockStatus = 'green' | 'amber' | 'red' | 'purple';

function robStatus(rob: number, minStock: number, reorderPoint: number | null): StockStatus {
  if (rob <= 0) return 'purple';
  if (rob <= minStock) return 'red';
  if (reorderPoint !== null && rob <= reorderPoint) return 'amber';
  return 'green';
}

@Injectable()
export class PartService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreatePartDto) {
    const [row] = this.drizzle.db
      .insert(parts)
      .values({
        id: newId(),
        tenantId: auth.tenantId,
        name: dto.name,
        description: dto.description ?? null,
        partNumber: dto.partNumber ?? null,
        unit: dto.unit ?? 'pcs',
        categoryId: dto.categoryId ?? null,
      })
      .returning()
      .all();
    return row;
  }

  findAll(auth: AuthContext) {
    return this.drizzle.db
      .select()
      .from(parts)
      .where(and(eq(parts.tenantId, auth.tenantId), isNull(parts.deletedAt)))
      .orderBy(parts.name)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(parts)
      .where(and(eq(parts.id, id), eq(parts.tenantId, auth.tenantId), isNull(parts.deletedAt)))
      .get();
    if (row === undefined) throw new NotFoundException(`Part ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdatePartDto) {
    this.findOne(auth, id);
    const [row] = this.drizzle.db
      .update(parts)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.partNumber !== undefined && { partNumber: dto.partNumber }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(parts.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(parts)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(parts.id, id))
      .run();
  }

  inventorySummary(auth: AuthContext) {
    const vesselId = requireVesselId(auth);
    const allParts = this.drizzle.db
      .select()
      .from(parts)
      .where(and(eq(parts.tenantId, auth.tenantId), isNull(parts.deletedAt)))
      .orderBy(parts.name)
      .all();

    const levels = this.drizzle.db
      .select({
        id: stockLevels.id,
        partId: stockLevels.partId,
        locationId: stockLevels.locationId,
        minStock: stockLevels.minStock,
        maxStock: stockLevels.maxStock,
        reorderPoint: stockLevels.reorderPoint,
        locationName: stockLocations.name,
      })
      .from(stockLevels)
      .innerJoin(stockLocations, eq(stockLevels.locationId, stockLocations.id))
      .where(
        and(
          eq(stockLevels.tenantId, auth.tenantId),
          eq(stockLevels.vesselId, vesselId),
          isNull(stockLevels.deletedAt),
        ),
      )
      .all();

    const robRows = this.drizzle.db
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
      .all();

    const robMap = new Map(robRows.map((r) => [`${r.partId}:${r.locationId}`, r.rob ?? '0']));

    return allParts.map((p) => {
      const partLevels = levels.filter((l) => l.partId === p.id);
      return {
        ...p,
        stockLevels: partLevels.map((l) => {
          const rob = parseFloat(robMap.get(`${p.id}:${l.locationId}`) ?? '0');
          const minStock = parseFloat(l.minStock ?? '0');
          const reorderPoint = l.reorderPoint ? parseFloat(l.reorderPoint) : null;
          return {
            id: l.id,
            locationId: l.locationId,
            locationName: l.locationName,
            minStock: l.minStock ?? '0',
            maxStock: l.maxStock ?? null,
            reorderPoint: l.reorderPoint ?? null,
            rob: rob.toString(),
            status: robStatus(rob, minStock, reorderPoint),
          };
        }),
      };
    });
  }
}
