import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAuditFindingDto, UpdateAuditFindingDto } from './dto/audit-finding.dto';

@Injectable()
export class AuditFindingService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateAuditFindingDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.auditFinding.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          auditId: dto.auditId ?? null,
          classification: dto.classification,
          smsRef: dto.smsRef ?? null,
          title: dto.title,
          detail: dto.detail ?? null,
          owner: dto.owner ?? null,
          openedAt: new Date(dto.openedAt),
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          closedAt: dto.closedAt ? new Date(dto.closedAt) : null,
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; auditId?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.auditFinding.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.auditId && { auditId: query.auditId }),
        },
        orderBy: { openedAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.auditFinding.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!row) throw new NotFoundException(`AuditFinding ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateAuditFindingDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.auditFinding.update({
        where: { id },
        data: {
          ...(dto.auditId !== undefined && { auditId: dto.auditId }),
          ...(dto.classification !== undefined && { classification: dto.classification }),
          ...(dto.smsRef !== undefined && { smsRef: dto.smsRef }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.detail !== undefined && { detail: dto.detail }),
          ...(dto.owner !== undefined && { owner: dto.owner }),
          ...(dto.openedAt !== undefined && { openedAt: new Date(dto.openedAt) }),
          ...(dto.dueAt !== undefined && {
            dueAt: dto.dueAt === null ? null : new Date(dto.dueAt),
          }),
          ...(dto.closedAt !== undefined && {
            closedAt: dto.closedAt === null ? null : new Date(dto.closedAt),
          }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.auditFinding.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
