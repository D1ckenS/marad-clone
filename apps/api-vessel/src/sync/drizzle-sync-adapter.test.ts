import { HlcClock, encodeHlc } from '@marad-clone/domain';
import { SyncEngine, createOutboxEntry, type SyncDelta } from '@marad-clone/sync-engine';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleSyncAdapter } from './drizzle-sync-adapter.js';

const MIGRATIONS_FOLDER = resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'drizzle');

function makeAdapter(): {
  adapter: DrizzleSyncAdapter;
  db: BetterSQLite3Database<Record<string, never>>;
  close: () => void;
} {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { adapter: new DrizzleSyncAdapter(db), db, close: () => sqlite.close() };
}

describe('DrizzleSyncAdapter — outbox', () => {
  let h: ReturnType<typeof makeAdapter>;
  beforeEach(() => {
    h = makeAdapter();
  });
  afterEach(() => h.close());

  it('roundtrips an outbox entry through SQLite', async () => {
    const clock = new HlcClock({ nodeId: 'vessel', now: () => 1_000_000 });
    const entry = createOutboxEntry({
      entityType: 'Component',
      entityId: 'C1',
      operation: 'upsert',
      payload: { name: { value: 'Engine', hlc: encodeHlc(clock.send()) } },
      hlc: clock.send(),
      nodeId: 'vessel',
    });
    await h.adapter.appendOutbox(entry);
    const pending = await h.adapter.readPendingOutbox(10);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe(entry.id);
    expect(pending[0]?.entityType).toBe('Component');
    expect(pending[0]?.payload).toEqual(entry.payload);
  });

  it('markSent excludes entries from subsequent reads', async () => {
    const clock = new HlcClock({ nodeId: 'vessel', now: () => 1_000_000 });
    const e1 = createOutboxEntry({
      entityType: 'X',
      entityId: 'a',
      operation: 'upsert',
      payload: {},
      hlc: clock.send(),
      nodeId: 'vessel',
    });
    const e2 = createOutboxEntry({
      entityType: 'X',
      entityId: 'b',
      operation: 'upsert',
      payload: {},
      hlc: clock.send(),
      nodeId: 'vessel',
    });
    await h.adapter.appendOutbox(e1);
    await h.adapter.appendOutbox(e2);
    await h.adapter.markSent([e1.id]);
    const pending = await h.adapter.readPendingOutbox(10);
    expect(pending.map((e) => e.id)).toEqual([e2.id]);
  });
});

describe('DrizzleSyncAdapter — applyRemoteDelta', () => {
  let h: ReturnType<typeof makeAdapter>;
  beforeEach(() => {
    h = makeAdapter();
  });
  afterEach(() => h.close());

  it('upserts a sync_record on first remote upsert', async () => {
    const hlc = '0000000f4240-0000-shore';
    const delta: SyncDelta = {
      entityType: 'Component',
      entityId: 'C1',
      operation: 'upsert',
      payload: { name: { value: 'Pump', hlc } },
      hlc,
      nodeId: 'shore',
    };
    const result = await h.adapter.applyRemoteDelta(delta);
    expect(result.merged).toBe(true);
    const stored = await h.adapter.readLocalRecord('Component', 'C1');
    expect(stored?.entityType).toBe('Component');
    expect((stored?.fields['name'] as { value: unknown }).value).toBe('Pump');
  });

  it('per-field LWW: newer remote field overrides older local', async () => {
    const hlc1 = '0000000f4240-0000-vessel';
    const hlc2 = '0000000f4242-0000-shore';
    await h.adapter.applyRemoteDelta({
      entityType: 'Component',
      entityId: 'C1',
      operation: 'upsert',
      payload: {
        status: { value: 'open', hlc: hlc1 },
        name: { value: 'Pump', hlc: hlc1 },
      },
      hlc: hlc1,
      nodeId: 'vessel',
    });
    const result = await h.adapter.applyRemoteDelta({
      entityType: 'Component',
      entityId: 'C1',
      operation: 'upsert',
      payload: { status: { value: 'closed', hlc: hlc2 } },
      hlc: hlc2,
      nodeId: 'shore',
    });
    expect((result.record.fields['status'] as { value: unknown }).value).toBe('closed');
    expect((result.record.fields['name'] as { value: unknown }).value).toBe('Pump');
  });

  it('soft-delete via newer-HLC delete', async () => {
    const hlc1 = '0000000f4240-0000-shore';
    const hlc2 = '0000000f4242-0000-shore';
    await h.adapter.applyRemoteDelta({
      entityType: 'Component',
      entityId: 'C1',
      operation: 'upsert',
      payload: { name: { value: 'Valve', hlc: hlc1 } },
      hlc: hlc1,
      nodeId: 'shore',
    });
    const result = await h.adapter.applyRemoteDelta({
      entityType: 'Component',
      entityId: 'C1',
      operation: 'delete',
      payload: null,
      hlc: hlc2,
      nodeId: 'shore',
    });
    expect(result.record.deletedAt).not.toBeNull();
  });
});

describe('DrizzleSyncAdapter — engine integration', () => {
  it('SyncEngine.write through Drizzle adapter populates outbox + sync_records', async () => {
    const h = makeAdapter();
    try {
      const clock = new HlcClock({ nodeId: 'vessel', now: () => 1_000_000 });
      const engine = new SyncEngine(h.adapter, clock, 'vessel');
      await engine.write('Component', 'C1', { name: 'Engine', status: 'active' });

      const pending = await h.adapter.readPendingOutbox(10);
      expect(pending).toHaveLength(1);

      const local = await h.adapter.readLocalRecord('Component', 'C1');
      expect(local).not.toBeNull();
      expect((local!.fields['name'] as { value: unknown }).value).toBe('Engine');
    } finally {
      h.close();
    }
  });
});
