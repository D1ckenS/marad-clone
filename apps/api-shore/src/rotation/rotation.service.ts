import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRotationDto, UpdateRotationDto } from './dto/create-rotation.dto';

@Injectable()
export class RotationService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateRotationDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.rotation.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          crewMemberId: dto.crewMemberId,
          plannedSignOn: new Date(dto.plannedSignOn),
          plannedSignOff: new Date(dto.plannedSignOff),
          notes: dto.notes ?? null,
        },
        include: { crewMember: true },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; crewMemberId?: string; status?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.rotation.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.crewMemberId && { crewMemberId: query.crewMemberId }),
          ...(query.status && { status: query.status as never }),
        },
        include: { crewMember: true },
        orderBy: { plannedSignOn: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.rotation.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
        include: { crewMember: true },
      }),
    );
    if (!row) throw new NotFoundException(`Rotation ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateRotationDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.rotation.update({
        where: { id },
        data: {
          ...(dto.status !== undefined && { status: dto.status as never }),
          ...(dto.plannedSignOn !== undefined && { plannedSignOn: new Date(dto.plannedSignOn) }),
          ...(dto.plannedSignOff !== undefined && { plannedSignOff: new Date(dto.plannedSignOff) }),
          ...(dto.actualSignOn !== undefined && {
            actualSignOn: dto.actualSignOn ? new Date(dto.actualSignOn) : null,
          }),
          ...(dto.actualSignOff !== undefined && {
            actualSignOff: dto.actualSignOff ? new Date(dto.actualSignOff) : null,
          }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        include: { crewMember: true },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.rotation.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
