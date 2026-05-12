import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { compareEncodedHlc } from '@fleetops/sync-engine';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HlcClockRegistry } from '../src/sync/hlc-clock-registry';
import { OutboxRecorder } from '../src/sync/outbox-recorder';

let app: INestApplication;
let prisma: PrismaService;
let recorder: OutboxRecorder;
let clocks: HlcClockRegistry;

const tenantId = ulid();
const vesselId = ulid();

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  prisma = moduleRef.get(PrismaService);
  recorder = moduleRef.get(OutboxRecorder);
  clocks = moduleRef.get(HlcClockRegistry);

  await prisma.tenant.create({ data: { id: tenantId, name: 'recorder-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Recorder' } });
});

afterAll(async () => {
  await prisma.outbox.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.syncRecord.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('OutboxRecorder — shore', () => {
  it('recordUpsert appends an outbox row + sync_records inside the caller tx', async () => {
    const entityId = ulid();
    const result = await prisma.$transaction(async (tx) =>
      recorder.recordUpsert(tx, { tenantId, vesselId }, 'Component', entityId, {
        name: 'Engine',
        runningHours: '0',
      }),
    );

    expect(result.hlc).toMatch(/^[0-9a-f]{12}-[0-9a-f]{4}-/);
    expect(result.nodeId).toBe(`${tenantId}-shore`);

    const outboxRow = await prisma.outbox.findFirst({
      where: { tenantId, vesselId, entityType: 'Component', entityId },
    });
    expect(outboxRow).not.toBeNull();
    expect(outboxRow?.operation).toBe('upsert');
    expect(outboxRow?.hlc).toBe(result.hlc);

    const syncRow = await prisma.syncRecord.findUnique({
      where: {
        tenantId_vesselId_entityType_entityId: {
          tenantId,
          vesselId,
          entityType: 'Component',
          entityId,
        },
      },
    });
    expect(syncRow).not.toBeNull();
    const fields = syncRow?.fields as Record<string, { value: unknown; hlc: string }>;
    expect(fields['name']?.value).toBe('Engine');
    expect(fields['name']?.hlc).toBe(result.hlc);
  });

  it('mints monotonically increasing HLCs for the same (tenant, vessel)', async () => {
    const entityId = ulid();
    const hlcs: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await prisma.$transaction(async (tx) =>
        recorder.recordUpsert(tx, { tenantId, vesselId }, 'Component', entityId, { tick: i }),
      );
      hlcs.push(r.hlc);
    }
    for (let i = 1; i < hlcs.length; i++) {
      expect(compareEncodedHlc(hlcs[i]!, hlcs[i - 1]!)).toBe(1);
    }
  });

  it('partial updates only overwrite the LWW field with a newer HLC', async () => {
    const entityId = ulid();
    await prisma.$transaction(async (tx) =>
      recorder.recordUpsert(tx, { tenantId, vesselId }, 'Component', entityId, {
        name: 'Pump',
        runningHours: '100',
      }),
    );
    await prisma.$transaction(async (tx) =>
      recorder.recordUpsert(tx, { tenantId, vesselId }, 'Component', entityId, {
        runningHours: '101',
      }),
    );

    const syncRow = await prisma.syncRecord.findUnique({
      where: {
        tenantId_vesselId_entityType_entityId: {
          tenantId,
          vesselId,
          entityType: 'Component',
          entityId,
        },
      },
    });
    const fields = syncRow!.fields as Record<string, { value: unknown; hlc: string }>;
    expect(fields['name']?.value).toBe('Pump'); // unchanged
    expect(fields['runningHours']?.value).toBe('101');
    expect(compareEncodedHlc(fields['runningHours']!.hlc, fields['name']!.hlc)).toBe(1);
  });

  it('a thrown tx rolls back the outbox and sync_records inserts atomically', async () => {
    const entityId = ulid();
    await expect(
      prisma.$transaction(async (tx) => {
        await recorder.recordUpsert(tx, { tenantId, vesselId }, 'Component', entityId, {
          name: 'Rollback',
        });
        throw new Error('forced rollback');
      }),
    ).rejects.toThrow(/forced rollback/);

    const outboxRow = await prisma.outbox.findFirst({
      where: { tenantId, vesselId, entityType: 'Component', entityId },
    });
    expect(outboxRow).toBeNull();

    const syncRow = await prisma.syncRecord.findUnique({
      where: {
        tenantId_vesselId_entityType_entityId: {
          tenantId,
          vesselId,
          entityType: 'Component',
          entityId,
        },
      },
    });
    expect(syncRow).toBeNull();
  });

  it('recordDelete writes a delete outbox row and tombstones sync_records', async () => {
    const entityId = ulid();
    await prisma.$transaction((tx) =>
      recorder.recordUpsert(tx, { tenantId, vesselId }, 'Component', entityId, { name: 'Doomed' }),
    );
    const result = await prisma.$transaction((tx) =>
      recorder.recordDelete(tx, { tenantId, vesselId }, 'Component', entityId),
    );

    const outboxRows = await prisma.outbox.findMany({
      where: { tenantId, vesselId, entityType: 'Component', entityId },
      orderBy: { createdAt: 'asc' },
    });
    expect(outboxRows).toHaveLength(2);
    expect(outboxRows[1]?.operation).toBe('delete');
    expect(outboxRows[1]?.hlc).toBe(result.hlc);

    const syncRow = await prisma.syncRecord.findUnique({
      where: {
        tenantId_vesselId_entityType_entityId: {
          tenantId,
          vesselId,
          entityType: 'Component',
          entityId,
        },
      },
    });
    expect(syncRow?.deletedAt).not.toBeNull();
  });

  it('different (tenant, vessel) pairs use different HLC clocks', async () => {
    const otherVesselId = ulid();
    await prisma.vessel.create({
      data: { id: otherVesselId, tenantId, name: 'MV Other' },
    });
    try {
      const a = clocks.entryFor(tenantId, vesselId);
      const b = clocks.entryFor(tenantId, otherVesselId);
      expect(a.clock).not.toBe(b.clock);
      expect(a.nodeId).toBe(b.nodeId); // both `${tenantId}-shore`
    } finally {
      await prisma.vessel.delete({ where: { id: otherVesselId } });
    }
  });
});
