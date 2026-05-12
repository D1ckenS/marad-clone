import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMasterComponentDto } from './dto/create-master-component.dto';
import type { UpdateMasterComponentDto } from './dto/update-master-component.dto';

/**
 * MasterComponents are shore-only templates that vessels clone into their
 * own Component rows. They do NOT go through the outbox/sync wire here —
 * vessel-side replication of the master library is a separate concern (a
 * full-table snapshot on connect, or on-demand fetch). Skipping outbox
 * writes keeps PR 2 small; revisit when the vessel-side master browser
 * lands in P1-3.
 */
@Injectable()
export class MasterComponentService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateMasterComponentDto) {
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.masterComponent.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId,
          name: dto.name,
          description: dto.description ?? null,
          sfi: dto.sfi ?? null,
          category: dto.category ?? null,
        },
      }),
    );
  }

  findAll(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.masterComponent.findMany({
        where: { tenantId: auth.tenantId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.masterComponent.findFirst({
        where: { id, tenantId: auth.tenantId, deletedAt: null },
      }),
    );
    if (row === null) throw new NotFoundException(`MasterComponent ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateMasterComponentDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.masterComponent.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.sfi !== undefined && { sfi: dto.sfi }),
          ...(dto.category !== undefined && { category: dto.category }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.masterComponent.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    );
  }
}
