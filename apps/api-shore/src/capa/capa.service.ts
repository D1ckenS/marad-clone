import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCapaDto, UpdateCapaDto } from './dto/create-capa.dto';

@Injectable()
export class CapaService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateCapaDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.capa.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          findingId: dto.findingId ?? null,
          type: dto.type,
          description: dto.description,
          ownerUserId: dto.ownerUserId ?? null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; findingId?: string; status?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.capa.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.findingId && { findingId: query.findingId }),
          ...(query.status && { status: query.status as never }),
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.capa.findFirst({ where: { id, tenantId: auth.tenantId!, deletedAt: null } }),
    );
    if (!row) throw new NotFoundException(`CAPA ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateCapaDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.capa.update({
        where: { id },
        data: {
          ...(dto.status !== undefined && { status: dto.status as never }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.ownerUserId !== undefined && { ownerUserId: dto.ownerUserId }),
          ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.capa.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  async verify(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.capa.update({ where: { id }, data: { status: 'VERIFIED', verifiedAt: new Date() } }),
    );
  }

  async close(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.capa.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } }),
    );
  }
}
