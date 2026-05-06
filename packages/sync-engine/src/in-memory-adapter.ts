import { compareEncodedHlc, mergeFields } from './lww.js';
import type { ApplyResult, OutboxEntry, SyncAdapter, SyncDelta, SyncRecord } from './types.js';

/**
 * In-memory SyncAdapter for unit tests and simulations.
 * No persistence — state lives in Maps for the lifetime of the instance.
 */
export class InMemoryAdapter implements SyncAdapter {
  private readonly outbox: OutboxEntry[] = [];
  private readonly sentIds = new Set<string>();
  private readonly records = new Map<string, SyncRecord>();

  async appendOutbox(entry: OutboxEntry): Promise<void> {
    this.outbox.push(entry);
  }

  async readPendingOutbox(limit: number): Promise<OutboxEntry[]> {
    return this.outbox.filter((e) => !this.sentIds.has(e.id)).slice(0, limit);
  }

  async markSent(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.sentIds.add(id);
    }
  }

  async applyRemoteDelta(delta: SyncDelta): Promise<ApplyResult> {
    const key = `${delta.entityType}:${delta.entityId}`;
    const existing = this.records.get(key);

    if (delta.operation === 'delete') {
      if (existing === undefined || compareEncodedHlc(delta.hlc, existing.hlc) > 0) {
        const record: SyncRecord = {
          entityType: delta.entityType,
          entityId: delta.entityId,
          hlc: delta.hlc,
          deletedAt: new Date().toISOString(),
          fields: existing?.fields ?? {},
        };
        this.records.set(key, record);
        return { record, merged: true };
      }
      return { record: existing, merged: false };
    }

    if (existing === undefined) {
      const record: SyncRecord = {
        entityType: delta.entityType,
        entityId: delta.entityId,
        hlc: delta.hlc,
        deletedAt: null,
        fields: delta.payload ?? {},
      };
      this.records.set(key, record);
      return { record, merged: true };
    }

    const { record: mergedFields, changed } = mergeFields(existing.fields, delta.payload ?? {});
    const newHlc = compareEncodedHlc(delta.hlc, existing.hlc) > 0 ? delta.hlc : existing.hlc;

    const deletedAt =
      existing.deletedAt !== null && compareEncodedHlc(delta.hlc, existing.hlc) > 0
        ? null
        : existing.deletedAt;

    const record: SyncRecord = {
      ...existing,
      hlc: newHlc,
      deletedAt,
      fields: mergedFields,
    };
    this.records.set(key, record);
    return { record, merged: changed || deletedAt !== existing.deletedAt };
  }

  async readLocalRecord(entityType: string, entityId: string): Promise<SyncRecord | null> {
    return this.records.get(`${entityType}:${entityId}`) ?? null;
  }

  /** Test helper: all records regardless of deleted status. */
  allRecords(): SyncRecord[] {
    return Array.from(this.records.values());
  }

  /** Test helper: pending outbox count. */
  pendingCount(): number {
    return this.outbox.filter((e) => !this.sentIds.has(e.id)).length;
  }
}
