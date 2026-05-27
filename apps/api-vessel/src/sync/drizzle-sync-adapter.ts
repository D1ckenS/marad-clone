import {
  compareEncodedHlc,
  mergeFields,
  type ApplyResult,
  type OutboxEntry,
  type SyncAdapter,
  type SyncDelta,
  type SyncRecord,
} from '@fleetops/sync-engine';
import { sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { materialiseTenantEntity } from './tenant-materialisers';

/**
 * Drizzle / SQLite implementation of SyncAdapter for the vessel side.
 *
 * Talks to the `outbox` and `sync_records` tables defined in
 * apps/api-vessel/src/db/schema.ts via raw SQL on the better-sqlite3
 * driver — the synchronous SQLite calls are wrapped in async methods to
 * satisfy the SyncAdapter contract (Prisma is async on the shore side).
 *
 * Materialisation: after the sync_records merge in applyRemoteDelta, this
 * adapter also writes through to the actual entity table for tenant-scoped
 * catalogs (e.g. Jha, MasterComponent, Supplier — see tenant-materialisers.ts).
 * Vessel-scoped deltas have no materialiser registered; their entity table
 * is populated by the originating service via OutboxRecorder.
 */
export class DrizzleSyncAdapter implements SyncAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle generic type is verbose; runtime checks are enough
  constructor(private readonly db: BetterSQLite3Database<any>) {}

  async appendOutbox(entry: OutboxEntry): Promise<void> {
    this.db.run(
      sql`INSERT INTO outbox (id, entity_type, entity_id, operation, payload, hlc, node_id, actor_user_id, sent_at)
          VALUES (${entry.id}, ${entry.entityType}, ${entry.entityId}, ${entry.operation},
                  ${entry.payload === null ? null : JSON.stringify(entry.payload)},
                  ${entry.hlc}, ${entry.nodeId}, ${entry.actorUserId ?? 'system'}, ${entry.sentAt})`,
    );
  }

  async readPendingOutbox(limit: number): Promise<OutboxEntry[]> {
    const rows = this.db.all<{
      id: string;
      entity_type: string;
      entity_id: string;
      operation: 'upsert' | 'delete';
      payload: string | null;
      hlc: string;
      node_id: string;
      actor_user_id: string;
      sent_at: number | null;
    }>(
      sql`SELECT id, entity_type, entity_id, operation, payload, hlc, node_id, actor_user_id, sent_at
          FROM outbox
          WHERE sent_at IS NULL
          ORDER BY created_at ASC
          LIMIT ${limit}`,
    );
    return rows.map((r) => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      operation: r.operation,
      payload: r.payload === null ? null : (JSON.parse(r.payload) as OutboxEntry['payload']),
      hlc: r.hlc,
      nodeId: r.node_id,
      actorUserId: r.actor_user_id,
      sentAt: r.sent_at,
    }));
  }

  async markSent(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const sentAt = Date.now();
    this.db.run(
      sql`UPDATE outbox SET sent_at = ${sentAt} WHERE id IN (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
  }

  async applyRemoteDelta(delta: SyncDelta): Promise<ApplyResult> {
    const existing = await this.readLocalRecord(delta.entityType, delta.entityId);
    const actorUserId =
      delta.actorUserId && delta.actorUserId.length > 0 ? delta.actorUserId : 'system';

    if (delta.operation === 'delete') {
      if (existing === null || compareEncodedHlc(delta.hlc, existing.hlc) > 0) {
        const record: SyncRecord = {
          entityType: delta.entityType,
          entityId: delta.entityId,
          hlc: delta.hlc,
          deletedAt: new Date().toISOString(),
          fields: existing?.fields ?? {},
          actorUserId,
        };
        await this.upsertSyncRecord(record);
        materialiseTenantEntity(
          this.db,
          record.entityType,
          record.entityId,
          record.fields,
          record.hlc,
          record.deletedAt,
        );
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
        actorUserId,
      };
      await this.upsertSyncRecord(record);
      materialiseTenantEntity(
        this.db,
        record.entityType,
        record.entityId,
        record.fields,
        record.hlc,
        null,
      );
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
      // Latest-writer-wins on the actor too — only stamp when the incoming
      // delta is strictly newer than what we already have.
      actorUserId:
        compareEncodedHlc(delta.hlc, existing.hlc) > 0
          ? actorUserId
          : (existing.actorUserId ?? 'system'),
    };
    await this.upsertSyncRecord(record);
    materialiseTenantEntity(
      this.db,
      record.entityType,
      record.entityId,
      record.fields,
      record.hlc,
      record.deletedAt,
    );
    return { record, merged: changed || deletedAt !== existing.deletedAt };
  }

  async readLocalRecord(entityType: string, entityId: string): Promise<SyncRecord | null> {
    const row = this.db.get<{
      entity_type: string;
      entity_id: string;
      hlc: string;
      deleted_at: string | null;
      fields: string;
      actor_user_id: string;
    }>(
      sql`SELECT entity_type, entity_id, hlc, deleted_at, fields, actor_user_id
          FROM sync_records
          WHERE entity_type = ${entityType} AND entity_id = ${entityId}`,
    );
    if (row === undefined) return null;
    return {
      entityType: row.entity_type,
      entityId: row.entity_id,
      hlc: row.hlc,
      deletedAt: row.deleted_at,
      fields: JSON.parse(row.fields) as SyncRecord['fields'],
      actorUserId: row.actor_user_id,
    };
  }

  private async upsertSyncRecord(record: SyncRecord): Promise<void> {
    this.db.run(
      sql`INSERT INTO sync_records (entity_type, entity_id, hlc, deleted_at, fields, actor_user_id)
          VALUES (${record.entityType}, ${record.entityId}, ${record.hlc}, ${record.deletedAt},
                  ${JSON.stringify(record.fields)}, ${record.actorUserId ?? 'system'})
          ON CONFLICT(entity_type, entity_id) DO UPDATE SET
            hlc = excluded.hlc,
            deleted_at = excluded.deleted_at,
            fields = excluded.fields,
            actor_user_id = excluded.actor_user_id`,
    );
  }
}
