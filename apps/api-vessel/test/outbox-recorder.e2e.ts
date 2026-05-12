import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { compareEncodedHlc } from '@marad-clone/sync-engine';
import { eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DrizzleService } from '../src/db/drizzle.service';
import { outbox, syncRecords } from '../src/db/schema';
import { OutboxRecorder } from '../src/sync/outbox-recorder';
import { HlcClockRegistry } from '../src/sync/hlc-clock-registry';

let app: INestApplication;
let drizzle: DrizzleService;
let recorder: OutboxRecorder;
let clocks: HlcClockRegistry;

const tenantId = ulid();
const vesselId = ulid();

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  drizzle = moduleRef.get(DrizzleService);
  recorder = moduleRef.get(OutboxRecorder);
  clocks = moduleRef.get(HlcClockRegistry);
});

afterAll(async () => {
  await app.close();
});

describe('OutboxRecorder — vessel', () => {
  it('recordUpsert appends an outbox row + sync_records inside the caller tx', () => {
    const entityId = ulid();
    const result = drizzle.db.transaction((tx) =>
      recorder.recordUpsert(tx, { tenantId, vesselId }, 'Component', entityId, {
        name: 'Engine',
        runningHours: '0',
      }),
    );

    expect(result.hlc).toMatch(/^[0-9a-f]{12}-[0-9a-f]{4}-/);
    expect(result.nodeId).toBe(`${vesselId}-vessel`);

    const outboxRows = drizzle.db.select().from(outbox).where(eq(outbox.entityId, entityId)).all();
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0]?.operation).toBe('upsert');
    expect(outboxRows[0]?.hlc).toBe(result.hlc);

    const syncRow = drizzle.db
      .select()
      .from(syncRecords)
      .where(eq(syncRecords.entityId, entityId))
      .all();
    expect(syncRow).toHaveLength(1);
    const fields = JSON.parse(syncRow[0]!.fields) as Record<
      string,
      { value: unknown; hlc: string }
    >;
    expect(fields['name']?.value).toBe('Engine');
  });

  it('mints monotonically increasing HLCs for the same (tenant, vessel)', () => {
    const entityId = ulid();
    const hlcs: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = drizzle.db.transaction((tx) =>
        recorder.recordUpsert(tx, { tenantId, vesselId }, 'Component', entityId, { tick: i }),
      );
      hlcs.push(r.hlc);
    }
    for (let i = 1; i < hlcs.length; i++) {
      expect(compareEncodedHlc(hlcs[i]!, hlcs[i - 1]!)).toBe(1);
    }
  });

  it('partial updates only overwrite the LWW field with a newer HLC', () => {
    const entityId = ulid();
    drizzle.db.transaction((tx) =>
      recorder.recordUpsert(tx, { tenantId, vesselId }, 'Component', entityId, {
        name: 'Pump',
        runningHours: '100',
      }),
    );
    drizzle.db.transaction((tx) =>
      recorder.recordUpsert(tx, { tenantId, vesselId }, 'Component', entityId, {
        runningHours: '101',
      }),
    );

    const row = drizzle.db
      .select()
      .from(syncRecords)
      .where(eq(syncRecords.entityId, entityId))
      .all();
    const fields = JSON.parse(row[0]!.fields) as Record<string, { value: unknown; hlc: string }>;
    expect(fields['name']?.value).toBe('Pump');
    expect(fields['runningHours']?.value).toBe('101');
    expect(compareEncodedHlc(fields['runningHours']!.hlc, fields['name']!.hlc)).toBe(1);
  });

  it('a thrown tx rolls back the outbox and sync_records inserts atomically', () => {
    const entityId = ulid();
    expect(() =>
      drizzle.db.transaction((tx) => {
        recorder.recordUpsert(tx, { tenantId, vesselId }, 'Component', entityId, {
          name: 'Rollback',
        });
        throw new Error('forced rollback');
      }),
    ).toThrow(/forced rollback/);

    const outboxRows = drizzle.db.select().from(outbox).where(eq(outbox.entityId, entityId)).all();
    expect(outboxRows).toHaveLength(0);

    const syncRow = drizzle.db
      .select()
      .from(syncRecords)
      .where(eq(syncRecords.entityId, entityId))
      .all();
    expect(syncRow).toHaveLength(0);
  });

  it('recordDelete writes a delete outbox row and tombstones sync_records', () => {
    const entityId = ulid();
    drizzle.db.transaction((tx) =>
      recorder.recordUpsert(tx, { tenantId, vesselId }, 'Component', entityId, { name: 'Doomed' }),
    );
    const result = drizzle.db.transaction((tx) =>
      recorder.recordDelete(tx, { tenantId, vesselId }, 'Component', entityId),
    );

    const outboxRows = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityId, entityId))
      .orderBy(outbox.createdAt)
      .all();
    expect(outboxRows).toHaveLength(2);
    expect(outboxRows[1]?.operation).toBe('delete');
    expect(outboxRows[1]?.hlc).toBe(result.hlc);

    const syncRow = drizzle.db
      .select()
      .from(syncRecords)
      .where(eq(syncRecords.entityId, entityId))
      .all();
    expect(syncRow[0]?.deletedAt).not.toBeNull();
  });

  it('registry returns one clock per (tenant, vessel) pair, vessel-scoped nodeId', () => {
    const a = clocks.entryFor(tenantId, vesselId);
    const b = clocks.entryFor(tenantId, vesselId);
    expect(a.clock).toBe(b.clock);
    expect(a.nodeId).toBe(`${vesselId}-vessel`);
  });
});
