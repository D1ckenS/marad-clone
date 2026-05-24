import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { TenantBroadcastRecorder } from '../sync/tenant-broadcast-recorder';
import type { CreateFuelProductDto, UpdateFuelProductDto } from './dto/create-fuel-product.dto';

function broadcastFields(row: {
  tenantId: string;
  name: string;
  tankType: string;
  sulphurPct: Prisma.Decimal | null;
  densityKgM3: Prisma.Decimal | null;
}): Record<string, unknown> {
  return {
    tenantId: row.tenantId,
    name: row.name,
    tankType: row.tankType,
    // Decimals serialise to string on the wire; vessel reads them back as
    // the SQLite numeric (TEXT) column.
    sulphurPct: row.sulphurPct?.toString() ?? null,
    densityKgM3: row.densityKgM3?.toString() ?? null,
  };
}

@Injectable()
export class FuelProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcaster: TenantBroadcastRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateFuelProductDto) {
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.fuelProduct.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          name: dto.name,
          tankType: dto.tankType as never,
          sulphurPct: dto.sulphurPct ? new Prisma.Decimal(dto.sulphurPct) : null,
          densityKgM3: dto.densityKgM3 ? new Prisma.Decimal(dto.densityKgM3) : null,
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'FuelProduct',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  findAll(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.fuelProduct.findMany({
        where: { tenantId: auth.tenantId!, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.fuelProduct.findFirst({ where: { id, tenantId: auth.tenantId!, deletedAt: null } }),
    );
    if (!row) throw new NotFoundException(`FuelProduct ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateFuelProductDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.fuelProduct.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.tankType !== undefined && { tankType: dto.tankType as never }),
          ...(dto.sulphurPct !== undefined && {
            sulphurPct: dto.sulphurPct ? new Prisma.Decimal(dto.sulphurPct) : null,
          }),
          ...(dto.densityKgM3 !== undefined && {
            densityKgM3: dto.densityKgM3 ? new Prisma.Decimal(dto.densityKgM3) : null,
          }),
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'FuelProduct',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, async (tx) => {
      await tx.fuelProduct.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.broadcaster.broadcastDelete(tx, auth.tenantId!, 'FuelProduct', id);
    });
  }
}
