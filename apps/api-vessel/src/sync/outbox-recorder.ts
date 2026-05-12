import { Injectable } from '@nestjs/common';
import { encodeHlc, newId } from '@marad-clone/domain';
import { mergeFields, type LwwRecord } from '@marad-clone/sync-engine';
import { sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { HlcClockRegistry } from './hlc-clock-registry';

/**
 * Tx-aware writer that bridges domain writes to the sync wire on the vessel
 * side. Mirrors `apps/api-shore/src/sync/outbox-recorder.ts` against
 * Drizzle/SQLite.
 *
 * Each `recordUpsert` / `recordDelete` call:
 *   1. Mints a fresh HLC from the (tenantId, vesselId) clock.
 *   2. Inserts an `outbox` row inside the caller's tx so the sync client
 *      drain loop picks it up.
 *   3. Materialises the local `sync_records` row (per-field LWW merge
 *      against any prior value) so future incoming deltas can resolve
 *      against the correct last-seen HLC per field.
 *
 * Methods are synchronous because better-sqlite3 is sync; callers wrap
 * the entity write + recorder call in a single `db.transaction((tx) => …)`
 * so all three writes commit or roll back together.
 *
 * Vessel outbox / sync_records have no tenant/vessel columns (one DB per
 * vessel), so the (tenantId, vesselId) here is only used to key the HLC
 * clock — not stored on the row.
 */
@Injectable()
export class OutboxRecorder {
  constructor(private readonly clocks: HlcClockRegistry) {}

  recordUpsert(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle generic is verbose; runtime SQL doesn't care
    tx: BetterSQLite3Database<any>,
    ctx: { tenantId: string; vesselId: string },
    entityType: string,
    entityId: string,
    fields: Record<string, unknown>,
  ): { hlc: string; nodeId: string } {
    const { clock, nodeId } = this.clocks.entryFor(ctx.tenantId, ctx.vesselId);
    const hlcStr = encodeHlc(clock.send());

    const incoming: LwwRecord = {};
    for (const [k, v] of Object.entries(fields)) {
      incoming[k] = { value: v, hlc: hlcStr };
    }

    tx.run(
      sql`INSERT INTO outbox (id, entity_type, entity_id, operation, payload, hlc, node_id, sent_at)
          VALUES (${newId()}, ${entityType}, ${entityId}, 'upsert',
                  ${JSON.stringify(incoming)}, ${hlcStr}, ${nodeId}, NULL)`,
    );

    this.mergeIntoSyncRecord(tx, entityType, entityId, hlcStr, incoming, false);

    return { hlc: hlcStr, nodeId };
  }

  recordDelete(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle generic is verbose; runtime SQL doesn't care
    tx: BetterSQLite3Database<any>,
    ctx: { tenantId: string; vesselId: string },
    entityType: string,
    entityId: string,
  ): { hlc: string; nodeId: string } {
    const { clock, nodeId } = this.clocks.entryFor(ctx.tenantId, ctx.vesselId);
    const hlcStr = encodeHlc(clock.send());

    tx.run(
      sql`INSERT INTO outbox (id, entity_type, entity_id, operation, payload, hlc, node_id, sent_at)
          VALUES (${newId()}, ${entityType}, ${entityId}, 'delete',
                  NULL, ${hlcStr}, ${nodeId}, NULL)`,
    );

    this.mergeIntoSyncRecord(tx, entityType, entityId, hlcStr, {}, true);

    return { hlc: hlcStr, nodeId };
  }

  private mergeIntoSyncRecord(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle generic is verbose; runtime SQL doesn't care
    tx: BetterSQLite3Database<any>,
    entityType: string,
    entityId: string,
    hlcStr: string,
    incoming: LwwRecord,
    deleted: boolean,
  ): void {
    const existing = tx.get<{ fields: string }>(
      sql`SELECT fields FROM sync_records
          WHERE entity_type = ${entityType} AND entity_id = ${entityId}`,
    );
    const baseFields: LwwRecord =
      existing === undefined ? {} : (JSON.parse(existing.fields) as LwwRecord);
    const { record: mergedFields } = mergeFields(baseFields, incoming);

    const deletedAt = deleted ? new Date().toISOString() : null;
    tx.run(
      sql`INSERT INTO sync_records (entity_type, entity_id, hlc, deleted_at, fields)
          VALUES (${entityType}, ${entityId}, ${hlcStr}, ${deletedAt}, ${JSON.stringify(mergedFields)})
          ON CONFLICT(entity_type, entity_id) DO UPDATE SET
            hlc = excluded.hlc,
            deleted_at = excluded.deleted_at,
            fields = excluded.fields`,
    );
  }
}
