import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { TenantBroadcastRecorder } from '../sync/tenant-broadcast-recorder';
import type { CreateQhseObjectiveDto, UpdateQhseObjectiveDto } from './dto/qhse-objective.dto';

function broadcastFields(row: {
  tenantId: string;
  category: string;
  label: string;
  target: string;
  actual: string;
  unit: string;
  status: string;
  delta: string | null;
  trend: unknown;
  periodFrom: Date | null;
  periodTo: Date | null;
}): Record<string, unknown> {
  return {
    tenantId: row.tenantId,
    category: row.category,
    label: row.label,
    target: row.target,
    actual: row.actual,
    unit: row.unit,
    status: row.status,
    delta: row.delta,
    trend: row.trend ?? null,
    periodFrom: row.periodFrom?.toISOString() ?? null,
    periodTo: row.periodTo?.toISOString() ?? null,
  };
}

@Injectable()
export class QhseObjectiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcaster: TenantBroadcastRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateQhseObjectiveDto) {
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.qhseObjective.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          category: dto.category,
          label: dto.label,
          target: dto.target,
          actual: dto.actual,
          unit: dto.unit,
          status: dto.status ?? 'GREEN',
          delta: dto.delta ?? null,
          trend:
            dto.trend === undefined || dto.trend === null
              ? Prisma.JsonNull
              : (dto.trend as Prisma.InputJsonValue),
          periodFrom: dto.periodFrom ? new Date(dto.periodFrom) : null,
          periodTo: dto.periodTo ? new Date(dto.periodTo) : null,
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'QhseObjective',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  findAll(auth: AuthContext, query: { category?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.qhseObjective.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.category && { category: query.category as never }),
        },
        orderBy: [{ category: 'asc' }, { label: 'asc' }],
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.qhseObjective.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!row) throw new NotFoundException(`QhseObjective ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateQhseObjectiveDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.qhseObjective.update({
        where: { id },
        data: {
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.label !== undefined && { label: dto.label }),
          ...(dto.target !== undefined && { target: dto.target }),
          ...(dto.actual !== undefined && { actual: dto.actual }),
          ...(dto.unit !== undefined && { unit: dto.unit }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.delta !== undefined && { delta: dto.delta }),
          ...(dto.trend !== undefined && {
            trend: dto.trend === null ? Prisma.JsonNull : (dto.trend as Prisma.InputJsonValue),
          }),
          ...(dto.periodFrom !== undefined && {
            periodFrom: dto.periodFrom === null ? null : new Date(dto.periodFrom),
          }),
          ...(dto.periodTo !== undefined && {
            periodTo: dto.periodTo === null ? null : new Date(dto.periodTo),
          }),
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'QhseObjective',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, async (tx) => {
      await tx.qhseObjective.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.broadcaster.broadcastDelete(tx, auth.tenantId!, 'QhseObjective', id);
    });
  }
}
