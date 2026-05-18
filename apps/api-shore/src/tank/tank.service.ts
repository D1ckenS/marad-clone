import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTankDto, UpdateTankDto } from './dto/create-tank.dto';

@Injectable()
export class TankService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateTankDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.tank.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          name: dto.name,
          tankType: dto.tankType as never,
          fuelProductId: dto.fuelProductId ?? null,
          capacityM3: dto.capacityM3 ? new Prisma.Decimal(dto.capacityM3) : null,
          framePosition: dto.framePosition ?? null,
        },
        include: { fuelProduct: true },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; tankType?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.tank.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.tankType && { tankType: query.tankType as never }),
        },
        include: { fuelProduct: true },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.tank.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
        include: {
          fuelProduct: true,
          readings: { where: { deletedAt: null }, orderBy: { readingDate: 'desc' }, take: 7 },
        },
      }),
    );
    if (!row) throw new NotFoundException(`Tank ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateTankDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.tank.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.tankType !== undefined && { tankType: dto.tankType as never }),
          ...(dto.fuelProductId !== undefined && { fuelProductId: dto.fuelProductId }),
          ...(dto.capacityM3 !== undefined && {
            capacityM3: dto.capacityM3 ? new Prisma.Decimal(dto.capacityM3) : null,
          }),
          ...(dto.framePosition !== undefined && { framePosition: dto.framePosition }),
        },
        include: { fuelProduct: true },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.tank.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
