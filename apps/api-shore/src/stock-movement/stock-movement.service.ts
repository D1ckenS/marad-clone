import { Injectable } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';
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
    private readonly prisma: PrismaService,
    private readonly recorder: OutboxRecorder,
  ) {}

  async create(auth: AuthContext, dto: CreateStockMovementDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
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
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId!, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.stockMovement.create({
        data: {
          id,
          tenantId: auth.tenantId!,
          vesselId,
          partId: dto.partId,
          locationId: dto.locationId,
          movementType: dto.movementType,
          quantity: new Prisma.Decimal(dto.quantity),
          referenceType: dto.referenceType ?? null,
          referenceId: dto.referenceId ?? null,
          notes: dto.notes ?? null,
          recordedAt: new Date(dto.recordedAt),
          hlc,
        },
      });
    });
  }

  findAll(auth: AuthContext, partId?: string, locationId?: string) {
    const vesselId = requireVesselId(auth);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.stockMovement.findMany({
        where: {
          tenantId: auth.tenantId!,
          vesselId,
          deletedAt: null,
          ...(partId && { partId }),
          ...(locationId && { locationId }),
        },
        orderBy: { recordedAt: 'desc' },
      }),
    );
  }

  async rob(auth: AuthContext): Promise<RobRow[]> {
    const vesselId = requireVesselId(auth);
    const rows = await this.prisma.withTenant(auth.tenantId!, async (tx) => {
      return tx.$queryRaw<{ part_id: string; location_id: string; rob: string }[]>`
        SELECT part_id, location_id, COALESCE(SUM(quantity), 0)::text AS rob
        FROM stock_movements
        WHERE tenant_id = ${auth.tenantId!}
          AND vessel_id = ${vesselId}
          AND deleted_at IS NULL
        GROUP BY part_id, location_id
      `;
    });
    return rows.map((r) => ({ partId: r.part_id, locationId: r.location_id, rob: r.rob }));
  }
}
