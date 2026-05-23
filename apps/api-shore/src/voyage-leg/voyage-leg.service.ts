import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateVoyageLegDto, UpdateVoyageLegDto } from './dto/voyage-leg.dto';

@Injectable()
export class VoyageLegService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateVoyageLegDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.voyageLeg.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          route: dto.route,
          departureAt: new Date(dto.departureAt),
          arrivalAt: new Date(dto.arrivalAt),
          nm: dto.nm,
          fuelTonnes: dto.fuelTonnes,
          co2Tonnes: dto.co2Tonnes,
          soxTonnes: dto.soxTonnes,
          noxTonnes: dto.noxTonnes,
          hours: dto.hours,
          mode: dto.mode,
          cargo: dto.cargo ?? null,
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; mode?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.voyageLeg.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.mode && { mode: query.mode as never }),
        },
        orderBy: { departureAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.voyageLeg.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!row) throw new NotFoundException(`VoyageLeg ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateVoyageLegDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.voyageLeg.update({
        where: { id },
        data: {
          ...(dto.route !== undefined && { route: dto.route }),
          ...(dto.departureAt !== undefined && { departureAt: new Date(dto.departureAt) }),
          ...(dto.arrivalAt !== undefined && { arrivalAt: new Date(dto.arrivalAt) }),
          ...(dto.nm !== undefined && { nm: dto.nm }),
          ...(dto.fuelTonnes !== undefined && { fuelTonnes: dto.fuelTonnes }),
          ...(dto.co2Tonnes !== undefined && { co2Tonnes: dto.co2Tonnes }),
          ...(dto.soxTonnes !== undefined && { soxTonnes: dto.soxTonnes }),
          ...(dto.noxTonnes !== undefined && { noxTonnes: dto.noxTonnes }),
          ...(dto.hours !== undefined && { hours: dto.hours }),
          ...(dto.mode !== undefined && { mode: dto.mode }),
          ...(dto.cargo !== undefined && { cargo: dto.cargo }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.voyageLeg.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
