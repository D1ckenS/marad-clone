import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSupplierDto } from './dto/create-supplier.dto';
import type { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateSupplierDto) {
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.supplier.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId,
          name: dto.name,
          contactName: dto.contactName ?? null,
          contactEmail: dto.contactEmail ?? null,
          contactPhone: dto.contactPhone ?? null,
          address: dto.address ?? null,
          country: dto.country ?? null,
          notes: dto.notes ?? null,
          isActive: dto.isActive ?? true,
        },
      }),
    );
  }

  findAll(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.supplier.findMany({
        where: { tenantId: auth.tenantId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.supplier.findFirst({ where: { id, tenantId: auth.tenantId, deletedAt: null } }),
    );
    if (row === null) throw new NotFoundException(`Supplier ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateSupplierDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.supplier.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.contactName !== undefined && { contactName: dto.contactName }),
          ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
          ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.country !== undefined && { country: dto.country }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.supplier.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
