import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreatePartDto) {
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.part.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId,
          name: dto.name,
          description: dto.description ?? null,
          partNumber: dto.partNumber ?? null,
          unit: dto.unit ?? 'pcs',
          categoryId: dto.categoryId ?? null,
        },
      }),
    );
  }

  findAll(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.part.findMany({
        where: { tenantId: auth.tenantId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.part.findFirst({ where: { id, tenantId: auth.tenantId, deletedAt: null } }),
    );
    if (row === null) throw new NotFoundException(`Part ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdatePartDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.part.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.partNumber !== undefined && { partNumber: dto.partNumber }),
          ...(dto.unit !== undefined && { unit: dto.unit }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.part.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  /** Returns all parts enriched with stock levels and computed ROB for the caller's vessel. */
  async inventorySummary(auth: AuthContext) {
    const vesselId = requireVesselId(auth);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const [parts, levels, robRows] = await Promise.all([
        tx.part.findMany({
          where: { tenantId: auth.tenantId, deletedAt: null },
          orderBy: { name: 'asc' },
        }),
        tx.stockLevel.findMany({
          where: { tenantId: auth.tenantId, vesselId, deletedAt: null },
          include: { location: true },
        }),
        tx.$queryRaw<{ part_id: string; location_id: string; rob: string }[]>`
          SELECT part_id, location_id, COALESCE(SUM(quantity), 0)::text AS rob
          FROM stock_movements
          WHERE tenant_id = ${auth.tenantId}
            AND vessel_id = ${vesselId}
            AND deleted_at IS NULL
          GROUP BY part_id, location_id
        `,
      ]);

      const robMap = new Map(robRows.map((r) => [`${r.part_id}:${r.location_id}`, r.rob]));

      return parts.map((p) => {
        const partLevels = levels.filter((l) => l.partId === p.id);
        return {
          ...p,
          stockLevels: partLevels.map((l) => {
            const rob = parseFloat(robMap.get(`${p.id}:${l.locationId}`) ?? '0');
            const minStock = parseFloat(l.minStock.toString());
            const reorderPoint = l.reorderPoint ? parseFloat(l.reorderPoint.toString()) : null;
            return {
              id: l.id,
              locationId: l.locationId,
              locationName: l.location.name,
              minStock: l.minStock.toString(),
              maxStock: l.maxStock?.toString() ?? null,
              reorderPoint: l.reorderPoint?.toString() ?? null,
              rob: rob.toString(),
              status: robStatus(rob, minStock, reorderPoint),
            };
          }),
        };
      });
    });
  }
}
