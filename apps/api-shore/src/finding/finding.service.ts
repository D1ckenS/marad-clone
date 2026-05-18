import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFindingDto, UpdateFindingDto } from './dto/create-finding.dto';

@Injectable()
export class FindingService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateFindingDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.finding.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          kind: dto.kind as never,
          title: dto.title,
          description: dto.description ?? null,
          raisedByUserId: dto.raisedByUserId ?? null,
          raisedAt: new Date(dto.raisedAt),
        },
        include: { capas: { where: { deletedAt: null } } },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; kind?: string; status?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.finding.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.kind && { kind: query.kind as never }),
          ...(query.status && { status: query.status as never }),
        },
        include: { capas: { where: { deletedAt: null } } },
        orderBy: { raisedAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.finding.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
        include: { capas: { where: { deletedAt: null } } },
      }),
    );
    if (!row) throw new NotFoundException(`Finding ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateFindingDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.finding.update({
        where: { id },
        data: {
          ...(dto.status !== undefined && { status: dto.status as never }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
        },
        include: { capas: { where: { deletedAt: null } } },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.finding.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  async close(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.finding.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date() },
        include: { capas: { where: { deletedAt: null } } },
      }),
    );
  }
}
