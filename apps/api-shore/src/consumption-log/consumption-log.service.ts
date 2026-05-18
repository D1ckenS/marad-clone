import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateConsumptionLogDto,
  UpdateConsumptionLogDto,
} from './dto/create-consumption-log.dto';

@Injectable()
export class ConsumptionLogService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateConsumptionLogDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.consumptionLog.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          fuelProductId: dto.fuelProductId ?? null,
          logDate: dto.logDate,
          consumerType: dto.consumerType as never,
          consumerName: dto.consumerName ?? null,
          consumptionMt: new Prisma.Decimal(dto.consumptionMt),
          voyageLeg: dto.voyageLeg ?? null,
          notes: dto.notes ?? null,
        },
        include: { fuelProduct: true },
      }),
    );
  }

  findAll(
    auth: AuthContext,
    query: { vesselId?: string; from?: string; to?: string; consumerType?: string },
  ) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.consumptionLog.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.consumerType && { consumerType: query.consumerType as never }),
          ...(query.from && { logDate: { gte: query.from } }),
          ...(query.to && { logDate: { lte: query.to } }),
        },
        include: { fuelProduct: true },
        orderBy: { logDate: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.consumptionLog.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
        include: { fuelProduct: true },
      }),
    );
    if (!row) throw new NotFoundException(`ConsumptionLog ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateConsumptionLogDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.consumptionLog.update({
        where: { id },
        data: {
          ...(dto.consumptionMt !== undefined && {
            consumptionMt: new Prisma.Decimal(dto.consumptionMt),
          }),
          ...(dto.voyageLeg !== undefined && { voyageLeg: dto.voyageLeg }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        include: { fuelProduct: true },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.consumptionLog.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
