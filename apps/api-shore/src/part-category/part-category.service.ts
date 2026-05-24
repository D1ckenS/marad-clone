import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { TenantBroadcastRecorder } from '../sync/tenant-broadcast-recorder';
import type { CreatePartCategoryDto } from './dto/create-part-category.dto';
import type { UpdatePartCategoryDto } from './dto/update-part-category.dto';

function broadcastFields(row: {
  tenantId: string;
  parentId: string | null;
  name: string;
  description: string | null;
}): Record<string, unknown> {
  return {
    tenantId: row.tenantId,
    parentId: row.parentId,
    name: row.name,
    description: row.description,
  };
}

@Injectable()
export class PartCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcaster: TenantBroadcastRecorder,
  ) {}

  create(auth: AuthContext, dto: CreatePartCategoryDto) {
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.partCategory.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          name: dto.name,
          description: dto.description ?? null,
          parentId: dto.parentId ?? null,
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'PartCategory',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  findAll(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.partCategory.findMany({
        where: { tenantId: auth.tenantId!, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.partCategory.findFirst({ where: { id, tenantId: auth.tenantId!, deletedAt: null } }),
    );
    if (row === null) throw new NotFoundException(`PartCategory ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdatePartCategoryDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.partCategory.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'PartCategory',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, async (tx) => {
      await tx.partCategory.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.broadcaster.broadcastDelete(tx, auth.tenantId!, 'PartCategory', id);
    });
  }
}
