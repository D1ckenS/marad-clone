import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateChecklistTemplateDto,
  UpdateChecklistTemplateDto,
} from './dto/create-checklist-template.dto';

@Injectable()
export class ChecklistTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateChecklistTemplateDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.checklistTemplate.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          title: dto.title,
          description: dto.description ?? null,
          itemsJson: dto.itemsJson,
        },
      }),
    );
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
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.checklistTemplate.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.itemsJson !== undefined && { itemsJson: dto.itemsJson }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.checklistTemplate.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
