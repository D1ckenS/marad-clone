import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAuditDto, UpdateAuditDto } from './dto/audit.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateAuditDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.audit.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId ?? null,
          kind: dto.kind,
          scope: dto.scope,
          scheduledAt: new Date(dto.scheduledAt),
          auditor: dto.auditor,
          status: dto.status ?? 'SCHEDULED',
          // findings starts at 0; AuditFindingService.{create,softDelete}
          // call `recomputeFindings` whenever an audit_findings row is
          // added or removed.
          findings: 0,
          notes: dto.notes ?? null,
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; kind?: string; status?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.audit.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.kind && { kind: query.kind as never }),
          ...(query.status && { status: query.status as never }),
        },
        orderBy: { scheduledAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.audit.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!row) throw new NotFoundException(`Audit ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateAuditDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.audit.update({
        where: { id },
        data: {
          ...(dto.vesselId !== undefined && { vesselId: dto.vesselId }),
          ...(dto.kind !== undefined && { kind: dto.kind }),
          ...(dto.scope !== undefined && { scope: dto.scope }),
          ...(dto.scheduledAt !== undefined && { scheduledAt: new Date(dto.scheduledAt) }),
          ...(dto.auditor !== undefined && { auditor: dto.auditor }),
          ...(dto.status !== undefined && { status: dto.status }),
          // findings is derived; see `recomputeFindings`.
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.audit.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  /**
   * Re-derive `audits.findings` from
   * `COUNT(audit_findings WHERE audit_id = X AND deleted_at IS NULL)`.
   * Call this in the same transaction as any AuditFinding mutation.
   * If `auditId` is null (a finding logged standalone, no parent audit),
   * this is a no-op.
   */
  static async recomputeFindings(tx: Prisma.TransactionClient, auditId: string | null) {
    if (!auditId) return;
    const count = await tx.auditFinding.count({
      where: { auditId, deletedAt: null },
    });
    await tx.audit.update({
      where: { id: auditId },
      data: { findings: count },
    });
  }
}
