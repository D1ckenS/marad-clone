import { HlcClock, encodeHlc } from '@marad-clone/domain';
import { describe, expect, it } from 'vitest';
import { InMemoryAdapter } from './in-memory-adapter.js';
import { createOutboxEntry } from './outbox.js';
import type { SyncDelta } from './types.js';

function makeClock(nodeId: string, startMs = 1_000_000) {
  let t = startMs;
  return new HlcClock({ nodeId, now: () => t++ });
}

function makeUpsertDelta(
  entityType: string,
  entityId: string,
  fields: Record<string, unknown>,
  hlcStr: string,
  nodeId: string,
): SyncDelta {
  const payload: Record<string, { value: unknown; hlc: string }> = {};
  for (const [k, v] of Object.entries(fields)) {
    payload[k] = { value: v, hlc: hlcStr };
  }
  return { entityType, entityId, operation: 'upsert', payload, hlc: hlcStr, nodeId };
}

function makeDeleteDelta(
  entityType: string,
  entityId: string,
  hlcStr: string,
  nodeId: string,
): SyncDelta {
  return { entityType, entityId, operation: 'delete', payload: null, hlc: hlcStr, nodeId };
}

// ── outbox ────────────────────────────────────────────────────────────────────

describe('InMemoryAdapter — outbox', () => {
  it('appendOutbox + readPendingOutbox roundtrip', async () => {
    const adapter = new InMemoryAdapter();
    const clock = makeClock('vessel');
    const entry = createOutboxEntry({
      entityType: 'Part',
      entityId: '01JTEST00000000000000000AA',
      operation: 'upsert',
      payload: { name: { value: 'Bearing', hlc: encodeHlc(clock.send()) } },
      hlc: clock.send(),
      nodeId: 'vessel',
    });
    await adapter.appendOutbox(entry);
    const pending = await adapter.readPendingOutbox(10);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe(entry.id);
  });

  it('markSent removes entries from pending', async () => {
    const adapter = new InMemoryAdapter();
    const clock = makeClock('vessel');
    const e1 = createOutboxEntry({
      entityType: 'Part',
      entityId: 'A',
      operation: 'upsert',
      payload: {},
      hlc: clock.send(),
      nodeId: 'vessel',
    });
    const e2 = createOutboxEntry({
      entityType: 'Part',
      entityId: 'B',
      operation: 'upsert',
      payload: {},
      hlc: clock.send(),
      nodeId: 'vessel',
    });
    await adapter.appendOutbox(e1);
    await adapter.appendOutbox(e2);
    await adapter.markSent([e1.id]);
    expect(await adapter.readPendingOutbox(10)).toHaveLength(1);
    expect(adapter.pendingCount()).toBe(1);
  });

  it('respects the limit parameter', async () => {
    const adapter = new InMemoryAdapter();
    const clock = makeClock('vessel');
    for (let i = 0; i < 5; i++) {
      await adapter.appendOutbox(
        createOutboxEntry({
          entityType: 'Part',
          entityId: `E${i}`,
          operation: 'upsert',
          payload: {},
          hlc: clock.send(),
          nodeId: 'vessel',
        }),
      );
    }
    expect(await adapter.readPendingOutbox(3)).toHaveLength(3);
  });
});

// ── applyRemoteDelta — upsert ─────────────────────────────────────────────────

describe('InMemoryAdapter — applyRemoteDelta upsert', () => {
  it('creates a new record on first upsert', async () => {
    const adapter = new InMemoryAdapter();
    const clock = makeClock('shore');
    const hlcStr = encodeHlc(clock.send());
    const delta = makeUpsertDelta('Component', 'C1', { name: 'Engine' }, hlcStr, 'shore');
    const { record, merged } = await adapter.applyRemoteDelta(delta);
    expect(merged).toBe(true);
    expect(record.entityId).toBe('C1');
    expect(record.deletedAt).toBeNull();
    expect((record.fields['name'] as { value: unknown }).value).toBe('Engine');
  });

  it('per-field LWW: remote wins when its HLC is newer', async () => {
    const adapter = new InMemoryAdapter();
    const clock = makeClock('vessel');
    const hlc1 = encodeHlc(clock.send());
    const hlc2 = encodeHlc(clock.send());

    await adapter.applyRemoteDelta(
      makeUpsertDelta('Component', 'C1', { status: 'open', name: 'Pump' }, hlc1, 'vessel'),
    );
    const { record } = await adapter.applyRemoteDelta(
      makeUpsertDelta('Component', 'C1', { status: 'closed' }, hlc2, 'shore'),
    );
    expect((record.fields['status'] as { value: unknown }).value).toBe('closed');
    expect((record.fields['name'] as { value: unknown }).value).toBe('Pump');
  });

  it('per-field LWW: local wins when its HLC is newer', async () => {
    const adapter = new InMemoryAdapter();
    const clock = makeClock('vessel');
    const hlc2 = encodeHlc(clock.send());
    const hlc1 = encodeHlc({ physicalMs: 1, counter: 0, nodeId: 'old' });

    await adapter.applyRemoteDelta(
      makeUpsertDelta('Component', 'C1', { status: 'closed' }, hlc2, 'vessel'),
    );
    const { record, merged } = await adapter.applyRemoteDelta(
      makeUpsertDelta('Component', 'C1', { status: 'open' }, hlc1, 'shore'),
    );
    expect((record.fields['status'] as { value: unknown }).value).toBe('closed');
    expect(merged).toBe(false);
  });
});

// ── applyRemoteDelta — delete ─────────────────────────────────────────────────

describe('InMemoryAdapter — applyRemoteDelta delete', () => {
  it('soft-deletes a record', async () => {
    const adapter = new InMemoryAdapter();
    const clock = makeClock('shore');
    const hlc1 = encodeHlc(clock.send());
    const hlc2 = encodeHlc(clock.send());
    await adapter.applyRemoteDelta(
      makeUpsertDelta('Component', 'C1', { name: 'Valve' }, hlc1, 'shore'),
    );
    const { record } = await adapter.applyRemoteDelta(
      makeDeleteDelta('Component', 'C1', hlc2, 'shore'),
    );
    expect(record.deletedAt).not.toBeNull();
  });

  it('older delete does not overwrite newer upsert', async () => {
    const adapter = new InMemoryAdapter();
    const clock = makeClock('shore');
    const hlcOld = encodeHlc({ physicalMs: 1, counter: 0, nodeId: 'old' });
    const hlcNew = encodeHlc(clock.send());
    await adapter.applyRemoteDelta(
      makeUpsertDelta('Component', 'C1', { name: 'Valve' }, hlcNew, 'shore'),
    );
    const { record, merged } = await adapter.applyRemoteDelta(
      makeDeleteDelta('Component', 'C1', hlcOld, 'shore'),
    );
    expect(record.deletedAt).toBeNull();
    expect(merged).toBe(false);
  });

  it('newer upsert after delete resurrects the record', async () => {
    const adapter = new InMemoryAdapter();
    const clock = makeClock('shore');
    const hlc1 = encodeHlc(clock.send());
    const hlc2 = encodeHlc(clock.send());
    const hlc3 = encodeHlc(clock.send());
    await adapter.applyRemoteDelta(
      makeUpsertDelta('Component', 'C1', { name: 'Valve' }, hlc1, 'shore'),
    );
    await adapter.applyRemoteDelta(makeDeleteDelta('Component', 'C1', hlc2, 'shore'));
    const { record } = await adapter.applyRemoteDelta(
      makeUpsertDelta('Component', 'C1', { name: 'Valve v2' }, hlc3, 'shore'),
    );
    expect(record.deletedAt).toBeNull();
  });

  it('readLocalRecord returns null for unknown entity', async () => {
    const adapter = new InMemoryAdapter();
    expect(await adapter.readLocalRecord('Component', 'C_UNKNOWN')).toBeNull();
  });
});
