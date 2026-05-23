import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateDischargeLogDto, UpdateDischargeLogDto } from './dto/discharge-log.dto';

@Injectable()
export class DischargeLogService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateDischargeLogDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.dischargeLog.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          kind: dto.kind,
          occurredAt: new Date(dto.occurredAt),
          location: dto.location,
          volume: dto.volume,
          notes: dto.notes ?? null,
          compliant: dto.compliant ?? true,
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.dischargeLog.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
        },
        orderBy: { occurredAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.dischargeLog.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!row) throw new NotFoundException(`DischargeLog ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateDischargeLogDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.dischargeLog.update({
        where: { id },
        data: {
          ...(dto.kind !== undefined && { kind: dto.kind }),
          ...(dto.occurredAt !== undefined && { occurredAt: new Date(dto.occurredAt) }),
          ...(dto.location !== undefined && { location: dto.location }),
          ...(dto.volume !== undefined && { volume: dto.volume }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.compliant !== undefined && { compliant: dto.compliant }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.dischargeLog.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
