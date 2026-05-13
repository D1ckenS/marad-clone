import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateStockLevelDto } from './dto/create-stock-level.dto';
import type { UpdateStockLevelDto } from './dto/update-stock-level.dto';

const ENTITY_TYPE = 'StockLevel';

@Injectable()
export class StockLevelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: OutboxRecorder,
  ) {}

  async create(auth: AuthContext, dto: CreateStockLevelDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const existing = await tx.stockLevel.findFirst({
        where: {
          tenantId: auth.tenantId,
          vesselId,
          partId: dto.partId,
          locationId: dto.locationId,
          deletedAt: null,
        },
      });
      if (existing) throw new ConflictException('StockLevel for this part+location already exists');

      const fields = {
        partId: dto.partId,
        locationId: dto.locationId,
        vesselId,
        minStock: dto.minStock ?? '0',
        maxStock: dto.maxStock ?? null,
        reorderPoint: dto.reorderPoint ?? null,
      };
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.stockLevel.create({
        data: {
          id,
          tenantId: auth.tenantId,
          vesselId,
          partId: dto.partId,
          locationId: dto.locationId,
          minStock: new Prisma.Decimal(dto.minStock ?? '0'),
          maxStock: dto.maxStock != null ? new Prisma.Decimal(dto.maxStock) : null,
          reorderPoint: dto.reorderPoint != null ? new Prisma.Decimal(dto.reorderPoint) : null,
          hlc,
        },
      });
    });
  }

  findAll(auth: AuthContext) {
    const vesselId = requireVesselId(auth);
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.stockLevel.findMany({
        where: { tenantId: auth.tenantId, vesselId, deletedAt: null },
        include: { part: true, location: true },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.stockLevel.findFirst({
        where: { id, tenantId: auth.tenantId, vesselId, deletedAt: null },
        include: { part: true, location: true },
      }),
    );
    if (row === null) throw new NotFoundException(`StockLevel ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateStockLevelDto) {
    const vesselId = requireVesselId(auth);
    await this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.minStock !== undefined) fields['minStock'] = dto.minStock;
    if (dto.maxStock !== undefined) fields['maxStock'] = dto.maxStock;
    if (dto.reorderPoint !== undefined) fields['reorderPoint'] = dto.reorderPoint;
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.stockLevel.update({
        where: { id },
        data: {
          ...(dto.minStock !== undefined && { minStock: new Prisma.Decimal(dto.minStock) }),
          ...(dto.maxStock !== undefined && {
            maxStock: dto.maxStock != null ? new Prisma.Decimal(dto.maxStock) : null,
          }),
          ...(dto.reorderPoint !== undefined && {
            reorderPoint: dto.reorderPoint != null ? new Prisma.Decimal(dto.reorderPoint) : null,
          }),
          hlc,
        },
      });
    });
  }

  async softDelete(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const { hlc } = await this.recorder.recordDelete(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
      );
      await tx.stockLevel.update({ where: { id }, data: { deletedAt: new Date(), hlc } });
    });
  }
}
