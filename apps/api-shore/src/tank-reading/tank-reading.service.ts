import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTankReadingDto, UpdateTankReadingDto } from './dto/create-tank-reading.dto';

@Injectable()
export class TankReadingService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateTankReadingDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.tankReading.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          tankId: dto.tankId,
          readingDate: dto.readingDate,
          robMt: new Prisma.Decimal(dto.robMt),
          robM3: dto.robM3 ? new Prisma.Decimal(dto.robM3) : null,
          trim: dto.trim ? new Prisma.Decimal(dto.trim) : null,
          notes: dto.notes ?? null,
          recordedByUserId: dto.recordedByUserId ?? auth.userId,
        },
        include: { tank: { include: { fuelProduct: true } } },
      }),
    );
  }

  findAll(
    auth: AuthContext,
    query: { vesselId?: string; tankId?: string; from?: string; to?: string },
  ) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.tankReading.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.tankId && { tankId: query.tankId }),
          ...(query.from && { readingDate: { gte: query.from } }),
          ...(query.to && { readingDate: { lte: query.to } }),
        },
        include: { tank: { include: { fuelProduct: true } } },
        orderBy: { readingDate: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.tankReading.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
        include: { tank: { include: { fuelProduct: true } } },
      }),
    );
    if (!row) throw new NotFoundException(`TankReading ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateTankReadingDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.tankReading.update({
        where: { id },
        data: {
          ...(dto.robMt !== undefined && { robMt: new Prisma.Decimal(dto.robMt) }),
          ...(dto.robM3 !== undefined && {
            robM3: dto.robM3 ? new Prisma.Decimal(dto.robM3) : null,
          }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        include: { tank: { include: { fuelProduct: true } } },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.tankReading.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
