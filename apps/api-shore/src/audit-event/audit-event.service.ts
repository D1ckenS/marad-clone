import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordAuditOpts {
  tenantId: string;
  vesselId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditEventService {
  constructor(private readonly prisma: PrismaService) {}

  record(opts: RecordAuditOpts) {
    return this.prisma.withTenant(opts.tenantId, (tx) =>
      tx.auditEvent.create({
        data: {
          id: newId(),
          tenantId: opts.tenantId,
          vesselId: opts.vesselId ?? null,
          actorUserId: opts.actorUserId ?? null,
          action: opts.action,
          entityType: opts.entityType,
          entityId: opts.entityId,
          metadata: opts.metadata ? (opts.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      }),
    );
  }

  findAll(
    auth: AuthContext,
    query: { vesselId?: string; entityType?: string; action?: string; limit?: number },
  ) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.auditEvent.findMany({
        where: {
          tenantId: auth.tenantId!,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.entityType && { entityType: query.entityType }),
          ...(query.action && { action: query.action }),
        },
        orderBy: { recordedAt: 'desc' },
        take: query.limit ?? 200,
      }),
    );
  }

  async getDnvEvidence(auth: AuthContext, vesselId: string) {
    const tenantId = auth.tenantId!;
    const now = new Date().toISOString();

    // Fetch vessel info, job histories, and audit events in parallel
    const [vessel, jobHistories, auditEvents] = await Promise.all([
      this.prisma.withTenant(tenantId, (tx) =>
        tx.vessel.findFirst({ where: { id: vesselId, tenantId } }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.jobHistory.findMany({
          where: { vesselId, tenantId, deletedAt: null },
          include: { job: { select: { title: true } }, component: { select: { name: true } } },
          orderBy: { completedAt: 'desc' },
        }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.auditEvent.findMany({
          where: { vesselId, tenantId },
          orderBy: { recordedAt: 'desc' },
        }),
      ),
    ]);

    // Verify the immutability trigger is present in the DB
    const triggerRows = await this.prisma.$queryRaw<Array<{ trigger_name: string }>>`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND event_object_table = 'job_histories'
        AND trigger_name = 'job_histories_immutable'
    `;
    const triggerVerified = triggerRows.length > 0;

    const periodStart = jobHistories.at(-1)?.completedAt ?? null;
    const periodEnd = jobHistories.at(0)?.completedAt ?? null;

    return {
      generatedAt: now,
      standard: 'DNV CG-0339',
      vessel: vessel ?? { id: vesselId },
      immutabilityVerification: {
        trigger: 'job_histories_immutable',
        table: 'job_histories',
        description:
          'BEFORE UPDATE OR DELETE trigger raises EXCEPTION on any attempt to modify or remove a JobHistory row, ensuring the maintenance completion record is permanently immutable.',
        verified: triggerVerified,
      },
      summary: {
        totalJobsCompleted: jobHistories.length,
        totalAuditEvents: auditEvents.length,
        periodStart,
        periodEnd,
      },
      jobHistories: jobHistories.map((h) => ({
        id: h.id,
        jobTitle: h.job?.title ?? null,
        componentName: h.component?.name ?? null,
        completedAt: h.completedAt,
        completedByUserId: h.completedByUserId,
        hoursWorked: h.hoursWorked,
        notes: h.notes,
        signatureHash: h.signatureHash,
      })),
      auditEvents: auditEvents.map((e) => ({
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        actorUserId: e.actorUserId,
        metadata: e.metadata,
        recordedAt: e.recordedAt,
      })),
    };
  }
}
