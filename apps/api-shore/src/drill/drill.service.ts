import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateDrillDto, CreateDrillRecordDto, UpdateDrillDto } from './dto/create-drill.dto';

@Injectable()
export class DrillService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateDrillDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drill.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          drillTypeId: dto.drillTypeId,
          scheduledAt: new Date(dto.scheduledAt),
          location: dto.location ?? null,
          leadOfficer: dto.leadOfficer ?? null,
          notes: dto.notes ?? null,
        },
        include: { drillType: true, records: true },
      }),
    );
  }

  findAll(auth: AuthContext, query: { status?: string; vesselId?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drill.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.status && { status: query.status as never }),
        },
        include: { drillType: true, records: { where: { deletedAt: null } } },
        orderBy: { scheduledAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drill.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
        include: { drillType: true, records: { where: { deletedAt: null } } },
      }),
    );
    if (!row) throw new NotFoundException(`Drill ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateDrillDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drill.update({
        where: { id },
        data: {
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.conductedAt !== undefined && { conductedAt: new Date(dto.conductedAt) }),
          ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
          ...(dto.location !== undefined && { location: dto.location }),
          ...(dto.leadOfficer !== undefined && { leadOfficer: dto.leadOfficer }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.reportKey !== undefined && { reportKey: dto.reportKey }),
        },
        include: { drillType: true, records: { where: { deletedAt: null } } },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drill.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  async addRecord(auth: AuthContext, drillId: string, dto: CreateDrillRecordDto) {
    const drill = await this.findOne(auth, drillId);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drillRecord.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: drill.vesselId,
          drillId,
          participantName: dto.participantName,
          role: dto.role ?? null,
          signedAt: dto.signedAt ? new Date(dto.signedAt) : null,
          signatureHash: dto.signatureHash ?? null,
        },
      }),
    );
  }
}
