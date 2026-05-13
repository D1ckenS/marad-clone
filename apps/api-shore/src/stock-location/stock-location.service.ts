import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateStockLocationDto } from './dto/create-stock-location.dto';
import type { UpdateStockLocationDto } from './dto/update-stock-location.dto';

const ENTITY_TYPE = 'StockLocation';

@Injectable()
export class StockLocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: OutboxRecorder,
  ) {}

  async create(auth: AuthContext, dto: CreateStockLocationDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const fields = { name: dto.name, description: dto.description ?? null, vesselId };
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.stockLocation.create({
        data: {
          id,
          tenantId: auth.tenantId,
          vesselId,
          name: dto.name,
          description: dto.description ?? null,
          hlc,
        },
      });
    });
  }

  findAll(auth: AuthContext) {
    const vesselId = requireVesselId(auth);
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.stockLocation.findMany({
        where: { tenantId: auth.tenantId, vesselId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.stockLocation.findFirst({
        where: { id, tenantId: auth.tenantId, vesselId, deletedAt: null },
      }),
    );
    if (row === null) throw new NotFoundException(`StockLocation ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateStockLocationDto) {
    const vesselId = requireVesselId(auth);
    await this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.name !== undefined) fields['name'] = dto.name;
    if (dto.description !== undefined) fields['description'] = dto.description;
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.stockLocation.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
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
      await tx.stockLocation.update({ where: { id }, data: { deletedAt: new Date(), hlc } });
    });
  }
}
