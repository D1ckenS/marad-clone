import {
  compareEncodedHlc,
  mergeFields,
  type ApplyResult,
  type LwwRecord,
  type OutboxEntry,
  type SyncAdapter,
  type SyncDelta,
  type SyncRecord,
} from '@fleetops/sync-engine';
import { Prisma, type PrismaClient } from '@prisma/client';

/**
 * Prisma / Postgres implementation of SyncAdapter for the shore side.
 *
 * Each instance is scoped to one (tenantId, vesselId) pair — the shore
 * runs N adapters in parallel, one per active vessel session, per ADR
 * 0002 §9. Tenant scoping is applied as a WHERE clause on every read /
 * write; RLS in the migration enforces the same at DB level for
 * least-privilege roles.
 */
export class PrismaSyncAdapter implements SyncAdapter {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantId: string,
    private readonly vesselId: string,
  ) {}

  async appendOutbox(entry: OutboxEntry): Promise<void> {
    await this.prisma.outbox.create({
      data: {
        id: entry.id,
        tenantId: this.tenantId,
        vesselId: this.vesselId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        operation: entry.operation,
        payload:
          entry.payload === null
            ? Prisma.JsonNull
            : (entry.payload as unknown as Prisma.InputJsonValue),
        hlc: entry.hlc,
        nodeId: entry.nodeId,
        sentAt: entry.sentAt === null ? null : new Date(entry.sentAt),
      },
    });
  }

  async readPendingOutbox(limit: number): Promise<OutboxEntry[]> {
    const rows = await this.prisma.outbox.findMany({
      where: { tenantId: this.tenantId, vesselId: this.vesselId, sentAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      operation: r.operation as 'upsert' | 'delete',
      payload: r.payload === null ? null : (r.payload as unknown as LwwRecord),
      hlc: r.hlc,
      nodeId: r.nodeId,
      sentAt: r.sentAt === null ? null : r.sentAt.getTime(),
    }));
  }

  async markSent(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.outbox.updateMany({
      where: { id: { in: ids }, tenantId: this.tenantId, vesselId: this.vesselId },
      data: { sentAt: new Date() },
    });
  }

  async applyRemoteDelta(delta: SyncDelta): Promise<ApplyResult> {
    const existing = await this.readLocalRecord(delta.entityType, delta.entityId);

    if (delta.operation === 'delete') {
      if (existing === null || compareEncodedHlc(delta.hlc, existing.hlc) > 0) {
        const record: SyncRecord = {
          entityType: delta.entityType,
          entityId: delta.entityId,
          hlc: delta.hlc,
          deletedAt: new Date().toISOString(),
          fields: existing?.fields ?? {},
        };
        await this.upsertSyncRecord(record);
        return { record, merged: true };
      }
      return { record: existing, merged: false };
    }

    if (existing === null) {
      const record: SyncRecord = {
        entityType: delta.entityType,
        entityId: delta.entityId,
        hlc: delta.hlc,
        deletedAt: null,
        fields: delta.payload ?? {},
      };
      await this.upsertSyncRecord(record);
      return { record, merged: true };
    }

    const { record: mergedFields, changed } = mergeFields(existing.fields, delta.payload ?? {});
    const newHlc = compareEncodedHlc(delta.hlc, existing.hlc) > 0 ? delta.hlc : existing.hlc;
    const deletedAt =
      existing.deletedAt !== null && compareEncodedHlc(delta.hlc, existing.hlc) > 0
        ? null
        : existing.deletedAt;

    const record: SyncRecord = {
      entityType: existing.entityType,
      entityId: existing.entityId,
      hlc: newHlc,
      deletedAt,
      fields: mergedFields,
    };
    await this.upsertSyncRecord(record);
    return { record, merged: changed || deletedAt !== existing.deletedAt };
  }

  async readLocalRecord(entityType: string, entityId: string): Promise<SyncRecord | null> {
    const row = await this.prisma.syncRecord.findUnique({
      where: {
        tenantId_vesselId_entityType_entityId: {
          tenantId: this.tenantId,
          vesselId: this.vesselId,
          entityType,
          entityId,
        },
      },
    });
    if (row === null) return null;
    return {
      entityType: row.entityType,
      entityId: row.entityId,
      hlc: row.hlc,
      deletedAt: row.deletedAt === null ? null : row.deletedAt.toISOString(),
      fields: row.fields as unknown as LwwRecord,
    };
  }

  private async upsertSyncRecord(record: SyncRecord): Promise<void> {
    await this.prisma.syncRecord.upsert({
      where: {
        tenantId_vesselId_entityType_entityId: {
          tenantId: this.tenantId,
          vesselId: this.vesselId,
          entityType: record.entityType,
          entityId: record.entityId,
        },
      },
      create: {
        tenantId: this.tenantId,
        vesselId: this.vesselId,
        entityType: record.entityType,
        entityId: record.entityId,
        hlc: record.hlc,
        deletedAt: record.deletedAt === null ? null : new Date(record.deletedAt),
        fields: record.fields as unknown as object,
      },
      update: {
        hlc: record.hlc,
        deletedAt: record.deletedAt === null ? null : new Date(record.deletedAt),
        fields: record.fields as unknown as object,
      },
    });
  }
}
