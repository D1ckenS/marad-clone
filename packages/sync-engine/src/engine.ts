import { decodeHlc, encodeHlc, type HlcClock } from '@fleetops/domain';
import { createOutboxEntry } from './outbox.js';
import type { ApplyResult, LwwRecord, OutboxEntry, SyncAdapter, SyncDelta } from './types.js';

export class SyncEngine {
  constructor(
    private readonly adapter: SyncAdapter,
    private readonly clock: HlcClock,
    private readonly nodeId: string,
  ) {}

  /**
   * Record a local write. Stamps every field with the current HLC and appends
   * an upsert entry to the outbox.
   */
  async write(
    entityType: string,
    entityId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    const hlc = this.clock.send();
    const hlcStr = encodeHlc(hlc);
    const payload: LwwRecord = {};
    for (const [k, v] of Object.entries(fields)) {
      payload[k] = { value: v, hlc: hlcStr };
    }
    await this.adapter.appendOutbox(
      createOutboxEntry({
        entityType,
        entityId,
        operation: 'upsert',
        payload,
        hlc,
        nodeId: this.nodeId,
      }),
    );
    // Materialize locally so future incoming merges have a base to compare against.
    await this.adapter.applyRemoteDelta({
      entityType,
      entityId,
      operation: 'upsert',
      payload,
      hlc: hlcStr,
      nodeId: this.nodeId,
    });
  }

  /**
   * Record a local soft-delete. Appends a delete entry to the outbox.
   * Hard deletes on synced entities are forbidden (ADR 0001).
   */
  async delete(entityType: string, entityId: string): Promise<void> {
    const hlc = this.clock.send();
    const hlcStr = encodeHlc(hlc);
    await this.adapter.appendOutbox(
      createOutboxEntry({
        entityType,
        entityId,
        operation: 'delete',
        payload: null,
        hlc,
        nodeId: this.nodeId,
      }),
    );
    await this.adapter.applyRemoteDelta({
      entityType,
      entityId,
      operation: 'delete',
      payload: null,
      hlc: hlcStr,
      nodeId: this.nodeId,
    });
  }

  /**
   * Apply a delta received from a remote node. Advances the local HLC to
   * incorporate the remote timestamp before delegating to the adapter.
   */
  async applyRemoteDelta(delta: SyncDelta): Promise<ApplyResult> {
    this.clock.receive(decodeHlc(delta.hlc));
    return this.adapter.applyRemoteDelta(delta);
  }

  /**
   * Pull up to `limit` unsent outbox entries and mark them as sent.
   * The actual transport is external — callers receive the entries and are
   * responsible for delivering them to the remote node.
   */
  async drainOutbox(limit = 100): Promise<OutboxEntry[]> {
    const pending = await this.adapter.readPendingOutbox(limit);
    if (pending.length > 0) {
      await this.adapter.markSent(pending.map((e) => e.id));
    }
    return pending;
  }
}
