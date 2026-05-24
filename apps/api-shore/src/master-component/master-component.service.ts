import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { TenantBroadcastRecorder } from '../sync/tenant-broadcast-recorder';
import type { CreateMasterComponentDto } from './dto/create-master-component.dto';
import type { UpdateMasterComponentDto } from './dto/update-master-component.dto';

function broadcastFields(row: {
  tenantId: string;
  name: string;
  description: string | null;
  sfi: string | null;
  category: string | null;
}): Record<string, unknown> {
  return {
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    sfi: row.sfi,
    category: row.category,
  };
}

/**
 * MasterComponents are tenant-scoped catalog rows that shore broadcasts
 * to every vessel of the tenant via TenantBroadcastRecorder (see
 * apps/docs/adr/0004-tenant-broadcast-sync.md). Vessels materialise into
 * their local `master_components` SQLite table via the materialiser
 * registered in apps/api-vessel/src/sync/tenant-materialisers.ts.
 */
@Injectable()
export class MasterComponentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcaster: TenantBroadcastRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateMasterComponentDto) {
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.masterComponent.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          name: dto.name,
          description: dto.description ?? null,
          sfi: dto.sfi ?? null,
          category: dto.category ?? null,
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'MasterComponent',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  findAll(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.masterComponent.findMany({
        where: { tenantId: auth.tenantId!, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.masterComponent.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (row === null) throw new NotFoundException(`MasterComponent ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateMasterComponentDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.masterComponent.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.sfi !== undefined && { sfi: dto.sfi }),
          ...(dto.category !== undefined && { category: dto.category }),
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'MasterComponent',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, async (tx) => {
      await tx.masterComponent.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.broadcaster.broadcastDelete(tx, auth.tenantId!, 'MasterComponent', id);
    });
  }
}
