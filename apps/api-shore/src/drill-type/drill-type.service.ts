import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { TenantBroadcastRecorder } from '../sync/tenant-broadcast-recorder';
import type { CreateDrillTypeDto } from './dto/create-drill-type.dto';
import type { UpdateDrillTypeDto } from './dto/update-drill-type.dto';

function broadcastFields(row: {
  tenantId: string;
  name: string;
  description: string | null;
}): Record<string, unknown> {
  return { tenantId: row.tenantId, name: row.name, description: row.description };
}

@Injectable()
export class DrillTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcaster: TenantBroadcastRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateDrillTypeDto) {
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.drillType.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          name: dto.name,
          description: dto.description ?? null,
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'DrillType',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  findAll(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drillType.findMany({
        where: { tenantId: auth.tenantId!, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drillType.findFirst({ where: { id, tenantId: auth.tenantId!, deletedAt: null } }),
    );
    if (!row) throw new NotFoundException(`DrillType ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateDrillTypeDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.drillType.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'DrillType',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, async (tx) => {
      await tx.drillType.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.broadcaster.broadcastDelete(tx, auth.tenantId!, 'DrillType', id);
    });
  }
}
