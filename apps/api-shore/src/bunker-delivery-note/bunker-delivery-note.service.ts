import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBdnDto, UpdateBdnDto } from './dto/create-bdn.dto';

@Injectable()
export class BunkerDeliveryNoteService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateBdnDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.bunkerDeliveryNote.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          fuelProductId: dto.fuelProductId ?? null,
          bdnNumber: dto.bdnNumber ?? null,
          deliveryDate: dto.deliveryDate,
          port: dto.port ?? null,
          supplierName: dto.supplierName ?? null,
          quantityMt: new Prisma.Decimal(dto.quantityMt),
          densityKgM3: dto.densityKgM3 ? new Prisma.Decimal(dto.densityKgM3) : null,
          sulphurPct: dto.sulphurPct ? new Prisma.Decimal(dto.sulphurPct) : null,
          grade: dto.grade ?? null,
          viscosity: dto.viscosity ? new Prisma.Decimal(dto.viscosity) : null,
          notes: dto.notes ?? null,
        },
        include: { fuelProduct: true },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; from?: string; to?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.bunkerDeliveryNote.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.from && { deliveryDate: { gte: query.from } }),
          ...(query.to && { deliveryDate: { lte: query.to } }),
        },
        include: { fuelProduct: true },
        orderBy: { deliveryDate: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.bunkerDeliveryNote.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
        include: { fuelProduct: true },
      }),
    );
    if (!row) throw new NotFoundException(`BunkerDeliveryNote ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateBdnDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.bunkerDeliveryNote.update({
        where: { id },
        data: {
          ...(dto.bdnNumber !== undefined && { bdnNumber: dto.bdnNumber }),
          ...(dto.quantityMt !== undefined && { quantityMt: new Prisma.Decimal(dto.quantityMt) }),
          ...(dto.densityKgM3 !== undefined && {
            densityKgM3: dto.densityKgM3 ? new Prisma.Decimal(dto.densityKgM3) : null,
          }),
          ...(dto.sulphurPct !== undefined && {
            sulphurPct: dto.sulphurPct ? new Prisma.Decimal(dto.sulphurPct) : null,
          }),
          ...(dto.grade !== undefined && { grade: dto.grade }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        include: { fuelProduct: true },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.bunkerDeliveryNote.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
