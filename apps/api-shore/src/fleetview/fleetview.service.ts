import { Injectable } from '@nestjs/common';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';

/** Summary and worklist results are cached per tenant for 30 seconds. */
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

@Injectable()
export class FleetviewService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCached(key: string, data: unknown, ttlMs = CACHE_TTL_MS): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  async getSummary(auth: AuthContext) {
    const tenantId = auth.tenantId!;
    const cacheKey = `summary:${tenantId}`;
    const cached = this.getCached<ReturnType<typeof this._fetchSummary>>(cacheKey);
    if (cached) return cached;
    const result = await this._fetchSummary(tenantId);
    this.setCached(cacheKey, result);
    return result;
  }

  private async _fetchSummary(tenantId: string) {
    const now = new Date();
    const in30d = new Date(now.getTime() + 30 * 86_400_000);
    const in7d = new Date(now.getTime() + 7 * 86_400_000);

    const vessels = await this.prisma.withTenant(tenantId, (tx) =>
      tx.vessel.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } }),
    );

    const vesselIds = vessels.map((v) => v.id);
    if (vesselIds.length === 0) {
      return {
        fleet: {
          totalVessels: 0,
          overdueJobs: 0,
          expiringCerts: 0,
          pendingApprovals: 0,
          openFindings: 0,
        },
        vessels: [],
      };
    }

    const [
      overdueByVessel,
      dueThisWeekByVessel,
      expiringByVessel,
      pendingByVessel,
      findingsByVessel,
    ] = await Promise.all([
      // Overdue job instances per vessel
      this.prisma.withTenant(tenantId, (tx) =>
        tx.jobInstance.groupBy({
          by: ['vesselId'],
          where: { tenantId, deletedAt: null, status: { not: 'DONE' }, dueAt: { lt: now } },
          _count: { id: true },
        }),
      ),
      // Due this week (not overdue)
      this.prisma.withTenant(tenantId, (tx) =>
        tx.jobInstance.groupBy({
          by: ['vesselId'],
          where: {
            tenantId,
            deletedAt: null,
            status: { not: 'DONE' },
            dueAt: { gte: now, lte: in7d },
          },
          _count: { id: true },
        }),
      ),
      // Certs expiring within 30 days
      this.prisma.withTenant(tenantId, (tx) =>
        tx.certificate.groupBy({
          by: ['vesselId'],
          where: {
            tenantId,
            deletedAt: null,
            vesselId: { not: null },
            expiresAt: { gte: now, lte: in30d },
          },
          _count: { id: true },
        }),
      ),
      // Pending approval requisitions
      this.prisma.withTenant(tenantId, (tx) =>
        tx.requisition.groupBy({
          by: ['vesselId'],
          where: { tenantId, deletedAt: null, status: 'SUBMITTED' },
          _count: { id: true },
        }),
      ),
      // Open findings
      this.prisma.withTenant(tenantId, (tx) =>
        tx.finding.groupBy({
          by: ['vesselId'],
          where: { tenantId, deletedAt: null, status: { not: 'CLOSED' } },
          _count: { id: true },
        }),
      ),
    ]);

    const idx = <T extends { vesselId: string; _count: { id: number } }>(rows: T[]) =>
      Object.fromEntries(rows.map((r) => [r.vesselId, r._count.id]));

    const overdueIdx = idx(overdueByVessel);
    const weekIdx = idx(dueThisWeekByVessel);
    const certIdx = idx(expiringByVessel.map((r) => ({ ...r, vesselId: r.vesselId as string })));
    const pendingIdx = idx(pendingByVessel);
    const findingsIdx = idx(findingsByVessel);

    const vesselRows = vessels.map((v) => ({
      id: v.id,
      name: v.name,
      imoNumber: v.imoNumber,
      status: {
        overdueJobs: overdueIdx[v.id] ?? 0,
        dueThisWeek: weekIdx[v.id] ?? 0,
        expiringCerts: certIdx[v.id] ?? 0,
        pendingApprovals: pendingIdx[v.id] ?? 0,
        openFindings: findingsIdx[v.id] ?? 0,
      },
    }));

    const fleet = {
      totalVessels: vessels.length,
      overdueJobs: vesselRows.reduce((s, v) => s + v.status.overdueJobs, 0),
      expiringCerts: vesselRows.reduce((s, v) => s + v.status.expiringCerts, 0),
      pendingApprovals: vesselRows.reduce((s, v) => s + v.status.pendingApprovals, 0),
      openFindings: vesselRows.reduce((s, v) => s + v.status.openFindings, 0),
    };

    return { fleet, vessels: vesselRows };
  }

  async getWorklist(auth: AuthContext, limit = 50) {
    const tenantId = auth.tenantId!;
    const cacheKey = `worklist:${tenantId}:${limit}`;
    const cached = this.getCached<ReturnType<typeof this._fetchWorklist>>(cacheKey);
    if (cached) return cached;
    const result = await this._fetchWorklist(tenantId, limit);
    this.setCached(cacheKey, result);
    return result;
  }

  private async _fetchWorklist(tenantId: string, limit: number) {
    const now = new Date();
    const in7d = new Date(now.getTime() + 7 * 86_400_000);

    const vessels = await this.prisma.withTenant(tenantId, (tx) =>
      tx.vessel.findMany({ where: { tenantId, deletedAt: null } }),
    );
    const vesselNameById = Object.fromEntries(vessels.map((v) => [v.id, v.name]));

    const [overdueJobs, pendingReqs, expiringCerts, openFindings] = await Promise.all([
      this.prisma.withTenant(tenantId, (tx) =>
        tx.jobInstance.findMany({
          where: { tenantId, deletedAt: null, status: { not: 'DONE' }, dueAt: { lt: now } },
          include: { job: { select: { title: true } } },
          orderBy: { dueAt: 'asc' },
          take: Math.ceil(limit / 4),
        }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.requisition.findMany({
          where: { tenantId, deletedAt: null, status: 'SUBMITTED' },
          orderBy: { createdAt: 'asc' },
          take: Math.ceil(limit / 4),
        }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.certificate.findMany({
          where: {
            tenantId,
            deletedAt: null,
            vesselId: { not: null },
            expiresAt: { gte: now, lte: in7d },
          },
          include: { certificateType: { select: { name: true } } },
          orderBy: { expiresAt: 'asc' },
          take: Math.ceil(limit / 4),
        }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.finding.findMany({
          where: { tenantId, deletedAt: null, status: { not: 'CLOSED' } },
          orderBy: { createdAt: 'asc' },
          take: Math.ceil(limit / 4),
        }),
      ),
    ]);

    const items: {
      type: string;
      vesselId: string;
      vesselName: string;
      entityId: string;
      description: string;
      dueAt: string | null;
      severity: 'red' | 'amber' | 'blue' | 'neutral';
    }[] = [];

    for (const j of overdueJobs) {
      items.push({
        type: 'JOB_OVERDUE',
        vesselId: j.vesselId,
        vesselName: vesselNameById[j.vesselId] ?? j.vesselId,
        entityId: j.id,
        description: j.job?.title ?? 'Job',
        dueAt: j.dueAt?.toISOString() ?? null,
        severity: 'red',
      });
    }

    for (const r of pendingReqs) {
      items.push({
        type: 'REQUISITION_PENDING',
        vesselId: r.vesselId,
        vesselName: vesselNameById[r.vesselId] ?? r.vesselId,
        entityId: r.id,
        description: r.title,
        dueAt: null,
        severity: 'amber',
      });
    }

    for (const c of expiringCerts) {
      items.push({
        type: 'CERT_EXPIRING',
        vesselId: c.vesselId!,
        vesselName: vesselNameById[c.vesselId!] ?? c.vesselId!,
        entityId: c.id,
        description: c.certificateType?.name ?? 'Certificate',
        dueAt: c.expiresAt?.toISOString() ?? null,
        severity: 'amber',
      });
    }

    for (const f of openFindings) {
      items.push({
        type: 'FINDING_OPEN',
        vesselId: f.vesselId,
        vesselName: vesselNameById[f.vesselId] ?? f.vesselId,
        entityId: f.id,
        description: f.title,
        dueAt: null,
        severity: 'neutral',
      });
    }

    items.sort((a, b) => {
      const order = { red: 0, amber: 1, blue: 2, neutral: 3 };
      return order[a.severity] - order[b.severity];
    });

    return { items: items.slice(0, limit) };
  }

  async getBudgetActuals(auth: AuthContext, year: number) {
    const tenantId = auth.tenantId!;
    const cacheKey = `budget-actuals:${tenantId}:${year}`;
    const cached = this.getCached<ReturnType<typeof this._fetchBudgetActuals>>(cacheKey);
    if (cached) return cached;
    const result = await this._fetchBudgetActuals(tenantId, year);
    this.setCached(cacheKey, result, 60_000);
    return result;
  }

  private async _fetchBudgetActuals(tenantId: string, year: number) {
    const yearStart = new Date(`${year}-01-01`);
    const yearEnd = new Date(`${year}-12-31T23:59:59`);

    const [budgets, poActuals] = await Promise.all([
      this.prisma.withTenant(tenantId, (tx) =>
        tx.budget.findMany({
          where: { tenantId, year },
          include: { lines: true },
          orderBy: { name: 'asc' },
        }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.purchaseOrder.groupBy({
          by: ['vesselId'],
          where: {
            tenantId,
            deletedAt: null,
            status: { notIn: ['DRAFT'] },
            createdAt: { gte: yearStart, lte: yearEnd },
          },
          _sum: { totalAmount: true },
        }),
      ),
    ]);

    const actualByVessel = Object.fromEntries(
      poActuals.map((r) => [r.vesselId, parseFloat((r._sum.totalAmount ?? 0).toString())]),
    );

    const result = budgets.map((b) => ({
      id: b.id,
      name: b.name,
      vesselId: b.vesselId,
      year: b.year,
      currency: b.currency,
      totalBudgeted: b.lines.reduce((s, l) => s + parseFloat(l.budgetedAmount.toString()), 0),
      totalActual: b.vesselId
        ? (actualByVessel[b.vesselId] ?? 0)
        : Object.values(actualByVessel).reduce((s, v) => s + v, 0),
      lines: b.lines.map((l) => ({
        id: l.id,
        category: l.category,
        budgetedAmount: parseFloat(l.budgetedAmount.toString()),
        currency: l.currency,
        notes: l.notes,
      })),
    }));

    return { year, budgets: result };
  }
}
