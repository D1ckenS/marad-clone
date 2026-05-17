import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateDrillTypeDto } from './dto/create-drill-type.dto';
import type { UpdateDrillTypeDto } from './dto/update-drill-type.dto';

@Injectable()
export class DrillTypeService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateDrillTypeDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drillType.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          name: dto.name,
          description: dto.description ?? null,
        },
      }),
    );
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
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drillType.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drillType.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
