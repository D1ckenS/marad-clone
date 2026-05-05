import { HlcClock, decodeHlc } from '@marad-clone/domain';
import { describe, expect, it } from 'vitest';
import { SyncEngine } from './engine.js';
import { InMemoryAdapter } from './in-memory-adapter.js';
import type { SyncDelta } from './types.js';

function makeEngine(nodeId: string, startMs = 1_000_000) {
  let t = startMs;
  const clock = new HlcClock({ nodeId, now: () => t++ });
  const adapter = new InMemoryAdapter();
  const engine = new SyncEngine(adapter, clock, nodeId);
  return { engine, adapter, clock };
}

// ── write ─────────────────────────────────────────────────────────────────────

describe('SyncEngine.write', () => {
  it('appends an upsert entry to the outbox', () => {
    const { engine, adapter } = makeEngine('vessel');
    engine.write('Component', 'C1', { name: 'Engine', status: 'active' });
    const pending = adapter.readPendingOutbox(10);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.operation).toBe('upsert');
    expect(pending[0]?.entityType).toBe('Component');
    expect(pending[0]?.entityId).toBe('C1');
  });

  it('stamps every field with the same HLC', () => {
    const { engine, adapter } = makeEngine('vessel');
    engine.write('Component', 'C1', { name: 'Engine', notes: 'ok' });
    const entry = adapter.readPendingOutbox(1)[0]!;
    const nameHlc = (entry.payload as Record<string, { hlc: string }>)['name']?.hlc;
    const notesHlc = (entry.payload as Record<string, { hlc: string }>)['notes']?.hlc;
    expect(nameHlc).toBe(notesHlc);
  });
});

// ── delete ─────────────────────────────────────────────────────────────────────

describe('SyncEngine.delete', () => {
  it('appends a delete entry with null payload', () => {
    const { engine, adapter } = makeEngine('vessel');
    engine.delete('Component', 'C1');
    const pending = adapter.readPendingOutbox(10);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.operation).toBe('delete');
    expect(pending[0]?.payload).toBeNull();
  });
});

// ── drainOutbox ───────────────────────────────────────────────────────────────

describe('SyncEngine.drainOutbox', () => {
  it('returns pending entries and marks them sent', () => {
    const { engine, adapter } = makeEngine('vessel');
    engine.write('Component', 'C1', { name: 'A' });
    engine.write('Component', 'C2', { name: 'B' });
    const drained = engine.drainOutbox();
    expect(drained).toHaveLength(2);
    expect(adapter.pendingCount()).toBe(0);
  });

  it('respects the limit', () => {
    const { engine, adapter } = makeEngine('vessel');
    for (let i = 0; i < 5; i++) engine.write('Part', `P${i}`, { qty: i });
    const drained = engine.drainOutbox(3);
    expect(drained).toHaveLength(3);
    expect(adapter.pendingCount()).toBe(2);
  });

  it('returns empty array when nothing is pending', () => {
    const { engine } = makeEngine('vessel');
    expect(engine.drainOutbox()).toHaveLength(0);
  });
});

// ── applyRemoteDelta ──────────────────────────────────────────────────────────

describe('SyncEngine.applyRemoteDelta', () => {
  it('advances the local clock to incorporate the remote HLC', () => {
    const { engine, clock } = makeEngine('vessel', 1_000);
    const remoteDelta: SyncDelta = {
      entityType: 'Component',
      entityId: 'C1',
      operation: 'upsert',
      payload: { name: { value: 'Engine', hlc: '0000000f4240-0000-shore' } }, // 1_000_000 ms
      hlc: '0000000f4240-0000-shore',
      nodeId: 'shore',
    };
    engine.applyRemoteDelta(remoteDelta);
    // After receiving the remote HLC, local clock must be > the remote HLC's physicalMs
    const afterReceive = clock.send();
    expect(afterReceive.physicalMs).toBeGreaterThanOrEqual(
      decodeHlc('0000000f4240-0000-shore').physicalMs,
    );
  });

  it('merges fields into local state via adapter', () => {
    const { engine, adapter } = makeEngine('vessel');
    const delta: SyncDelta = {
      entityType: 'Component',
      entityId: 'C1',
      operation: 'upsert',
      payload: { name: { value: 'Pump', hlc: '0000000f4240-0000-shore' } },
      hlc: '0000000f4240-0000-shore',
      nodeId: 'shore',
    };
    engine.applyRemoteDelta(delta);
    const record = adapter.readLocalRecord('Component', 'C1');
    expect(record).not.toBeNull();
    expect((record!.fields['name'] as { value: unknown }).value).toBe('Pump');
  });
});

// ── two-node convergence ──────────────────────────────────────────────────────

describe('two-node convergence', () => {
  it('vessel and shore converge after exchanging deltas', () => {
    const vessel = makeEngine('vessel', 1_000);
    const shore = makeEngine('shore', 2_000);

    // Both write to the same entity concurrently
    vessel.engine.write('Component', 'C1', { name: 'Engine', status: 'active' });
    shore.engine.write('Component', 'C1', { status: 'maintenance', notes: 'overhaul' });

    // Exchange: drain outboxes and apply each side to the other
    const vesselDeltas = vessel.engine.drainOutbox().map(
      (e) =>
        ({
          entityType: e.entityType,
          entityId: e.entityId,
          operation: e.operation,
          payload: e.payload,
          hlc: e.hlc,
          nodeId: e.nodeId,
        }) satisfies SyncDelta,
    );

    const shoreDeltas = shore.engine.drainOutbox().map(
      (e) =>
        ({
          entityType: e.entityType,
          entityId: e.entityId,
          operation: e.operation,
          payload: e.payload,
          hlc: e.hlc,
          nodeId: e.nodeId,
        }) satisfies SyncDelta,
    );

    for (const d of shoreDeltas) vessel.engine.applyRemoteDelta(d);
    for (const d of vesselDeltas) shore.engine.applyRemoteDelta(d);

    const vesselRecord = vessel.adapter.readLocalRecord('Component', 'C1')!;
    const shoreRecord = shore.adapter.readLocalRecord('Component', 'C1')!;

    // Both sides must have the same winning value for 'status'
    expect((vesselRecord.fields['status'] as { value: unknown }).value).toBe(
      (shoreRecord.fields['status'] as { value: unknown }).value,
    );
    // Both sides must see the field written only by vessel
    expect(vesselRecord.fields['name']).toBeDefined();
    expect(shoreRecord.fields['name']).toBeDefined();
    // Both sides must see the field written only by shore
    expect(vesselRecord.fields['notes']).toBeDefined();
    expect(shoreRecord.fields['notes']).toBeDefined();
  });
});
