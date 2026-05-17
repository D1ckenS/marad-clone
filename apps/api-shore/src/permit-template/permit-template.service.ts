import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreatePermitTemplateDto,
  UpdatePermitTemplateDto,
} from './dto/create-permit-template.dto';

@Injectable()
export class PermitTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreatePermitTemplateDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.permitTemplate.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          permitType: dto.permitType,
          name: dto.name,
          checklistItemsJson: dto.checklistItemsJson ?? null,
        },
      }),
    );
  }

  findAll(auth: AuthContext, permitType?: string) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.permitTemplate.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(permitType && { permitType: permitType as never }),
        },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.permitTemplate.findFirst({ where: { id, tenantId: auth.tenantId!, deletedAt: null } }),
    );
    if (!row) throw new NotFoundException(`PermitTemplate ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdatePermitTemplateDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.permitTemplate.update({
        where: { id },
        data: {
          ...(dto.permitType !== undefined && { permitType: dto.permitType }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.checklistItemsJson !== undefined && {
            checklistItemsJson: dto.checklistItemsJson,
          }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.permitTemplate.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
