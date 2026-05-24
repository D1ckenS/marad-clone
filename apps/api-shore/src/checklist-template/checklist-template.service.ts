import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { TenantBroadcastRecorder } from '../sync/tenant-broadcast-recorder';
import type {
  CreateChecklistTemplateDto,
  UpdateChecklistTemplateDto,
} from './dto/create-checklist-template.dto';

function broadcastFields(row: {
  tenantId: string;
  title: string;
  description: string | null;
  itemsJson: string;
}): Record<string, unknown> {
  return {
    tenantId: row.tenantId,
    title: row.title,
    description: row.description,
    itemsJson: row.itemsJson,
  };
}

@Injectable()
export class ChecklistTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcaster: TenantBroadcastRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateChecklistTemplateDto) {
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.checklistTemplate.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          title: dto.title,
          description: dto.description ?? null,
          itemsJson: dto.itemsJson,
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'ChecklistTemplate',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  findAll(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.checklistTemplate.findMany({
        where: { tenantId: auth.tenantId!, deletedAt: null },
        orderBy: { title: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.checklistTemplate.findFirst({ where: { id, tenantId: auth.tenantId!, deletedAt: null } }),
    );
    if (!row) throw new NotFoundException(`ChecklistTemplate ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateChecklistTemplateDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.checklistTemplate.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.itemsJson !== undefined && { itemsJson: dto.itemsJson }),
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'ChecklistTemplate',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, async (tx) => {
      await tx.checklistTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.broadcaster.broadcastDelete(tx, auth.tenantId!, 'ChecklistTemplate', id);
    });
  }
}
