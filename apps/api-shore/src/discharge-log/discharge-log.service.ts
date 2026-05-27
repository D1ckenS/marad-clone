import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { AuditEventService } from '../audit-event/audit-event.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateDischargeLogDto, UpdateDischargeLogDto } from './dto/discharge-log.dto';

// M6: MARPOL non-compliance is a fileable incident — Annex I (Oil),
// Annex IV (Sewage), and Annex V (Garbage) all require audit trails
// when an operator records a non-compliant discharge. This service
// fires `MARPOL_NON_COMPLIANT_DISCHARGE` AuditEvents on both create
// (compliant=false at intake) and update (compliant true→false
// transition) so flag-state and class-society audits can reconstruct
// the chain without trusting display-layer aggregation.
const NON_COMPLIANT_ACTION = 'MARPOL_NON_COMPLIANT_DISCHARGE';

@Injectable()
export class DischargeLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditEventService,
  ) {}

  async create(auth: AuthContext, dto: CreateDischargeLogDto) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
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
    if (!row.compliant) {
      // Fire-and-forget — audit must never block the primary write.
      void this.audit
        .record({
          tenantId: auth.tenantId!,
          vesselId: row.vesselId,
          actorUserId: auth.userId,
          action: NON_COMPLIANT_ACTION,
          entityType: 'DischargeLog',
          entityId: row.id,
          metadata: {
            kind: row.kind,
            occurredAt: row.occurredAt.toISOString(),
            location: row.location,
            volume: row.volume,
            transition: 'create-non-compliant',
          },
        })
        .catch(() => null);
    }
    return row;
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
    const before = await this.findOne(auth, id);
    const updated = await this.prisma.withTenant(auth.tenantId!, (tx) =>
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
    // Emit on the true→false transition only; repeated PATCHes that
    // keep compliant=false don't re-fire.
    if (before.compliant && !updated.compliant) {
      void this.audit
        .record({
          tenantId: auth.tenantId!,
          vesselId: updated.vesselId,
          actorUserId: auth.userId,
          action: NON_COMPLIANT_ACTION,
          entityType: 'DischargeLog',
          entityId: updated.id,
          metadata: {
            kind: updated.kind,
            occurredAt: updated.occurredAt.toISOString(),
            location: updated.location,
            volume: updated.volume,
            transition: 'patch-compliant-to-non-compliant',
          },
        })
        .catch(() => null);
    }
    return updated;
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.dischargeLog.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  /**
   * M6: Count non-compliant discharges in the current calendar year.
   * Drives the Fleetview "MARPOL non-compliant (YTD)" widget. Returns
   * per-vessel breakdown so the dashboard can highlight outliers.
   */
  async nonCompliantYtd(auth: AuthContext, vesselId?: string) {
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const rows = await tx.dischargeLog.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          compliant: false,
          occurredAt: { gte: yearStart },
          ...(vesselId && { vesselId }),
        },
        orderBy: { occurredAt: 'desc' },
      });
      const total = rows.length;
      const byVessel = new Map<string, number>();
      for (const r of rows) {
        byVessel.set(r.vesselId, (byVessel.get(r.vesselId) ?? 0) + 1);
      }
      return {
        year: yearStart.getUTCFullYear(),
        total,
        byVessel: [...byVessel.entries()].map(([id, count]) => ({ vesselId: id, count })),
      };
    });
  }

  /**
   * M6: IOPP-style CSV export. MARPOL Annex I appendix III specifies
   * the Oil Record Book Part I/II columns we ship as headers below;
   * the equivalent for Garbage (Annex V) is a Garbage Record Book.
   * This export concatenates all kinds in one CSV — auditors filter
   * downstream. Production-grade per-book format would split per
   * Annex, deferred until the first pilot's flag-state confirms.
   */
  async exportCsv(auth: AuthContext, opts: { vesselId?: string; from?: string; to?: string }) {
    const filter: { gte?: Date; lte?: Date } = {};
    if (opts.from) {
      const d = new Date(opts.from);
      if (!Number.isNaN(d.getTime())) filter.gte = d;
    }
    if (opts.to) {
      const d = new Date(opts.to);
      if (!Number.isNaN(d.getTime())) filter.lte = d;
    }
    const rows = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.dischargeLog.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(opts.vesselId && { vesselId: opts.vesselId }),
          ...((filter.gte || filter.lte) && { occurredAt: filter }),
        },
        orderBy: { occurredAt: 'asc' },
      }),
    );

    // IOPP / ORB-style columns. Quote everything so embedded commas in
    // location names don't break consumers.
    const escape = (v: string) => '"' + v.replace(/"/g, '""') + '"';
    const header = ['Date', 'Vessel ID', 'Kind', 'Location', 'Volume', 'Compliant', 'Notes']
      .map(escape)
      .join(',');
    const lines = rows.map((r) =>
      [
        r.occurredAt.toISOString(),
        r.vesselId,
        r.kind,
        r.location,
        r.volume,
        r.compliant ? 'YES' : 'NO',
        r.notes ?? '',
      ]
        .map((v) => escape(String(v)))
        .join(','),
    );
    return [header, ...lines].join('\n') + '\n';
  }
}
