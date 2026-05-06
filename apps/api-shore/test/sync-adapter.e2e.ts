import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaSyncAdapter } from '../src/sync/prisma-sync-adapter';

let app: INestApplication;
let prisma: PrismaService;

// Each run uses a fresh tenant + vessel so concurrent CI runs do not interfere.
const tenantId = ulid();
const vesselId = ulid();

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  prisma = moduleRef.get(PrismaService);

  await prisma.tenant.create({ data: { id: tenantId, name: 'sync-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'sync-test-vessel' } });
});

afterAll(async () => {
  await prisma.outbox.deleteMany({ where: { tenantId } });
  await prisma.syncRecord.deleteMany({ where: { tenantId } });
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('PrismaSyncAdapter — e2e against Postgres', () => {
  it('appendOutbox + readPendingOutbox roundtrip', async () => {
    const adapter = new PrismaSyncAdapter(prisma, tenantId, vesselId);
    await adapter.appendOutbox({
      id: ulid(),
      entityType: 'Component',
      entityId: 'C1',
      operation: 'upsert',
      payload: { name: { value: 'Engine', hlc: '0000000f4240-0000-shore' } },
      hlc: '0000000f4240-0000-shore',
      nodeId: 'shore',
      sentAt: null,
    });
    const pending = await adapter.readPendingOutbox(10);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.entityType).toBe('Component');
    expect(pending[0]?.payload).toEqual({
      name: { value: 'Engine', hlc: '0000000f4240-0000-shore' },
    });
  });

  it('markSent removes entries from pending', async () => {
    const adapter = new PrismaSyncAdapter(prisma, tenantId, vesselId);
    const id = ulid();
    await adapter.appendOutbox({
      id,
      entityType: 'X',
      entityId: 'a',
      operation: 'upsert',
      payload: {},
      hlc: '0000000f4241-0000-shore',
      nodeId: 'shore',
      sentAt: null,
    });
    await adapter.markSent([id]);
    const remaining = (await adapter.readPendingOutbox(10)).map((e) => e.id);
    expect(remaining).not.toContain(id);
  });

  it('per-field LWW upsert through Prisma', async () => {
    const adapter = new PrismaSyncAdapter(prisma, tenantId, vesselId);
    const hlc1 = '0000000f4250-0000-vessel';
    const hlc2 = '0000000f4251-0000-shore';
    await adapter.applyRemoteDelta({
      entityType: 'Component',
      entityId: 'C-LWW',
      operation: 'upsert',
      payload: {
        status: { value: 'open', hlc: hlc1 },
        name: { value: 'Pump', hlc: hlc1 },
      },
      hlc: hlc1,
      nodeId: 'vessel',
    });
    const merged = await adapter.applyRemoteDelta({
      entityType: 'Component',
      entityId: 'C-LWW',
      operation: 'upsert',
      payload: { status: { value: 'closed', hlc: hlc2 } },
      hlc: hlc2,
      nodeId: 'shore',
    });
    expect((merged.record.fields['status'] as { value: unknown }).value).toBe('closed');
    expect((merged.record.fields['name'] as { value: unknown }).value).toBe('Pump');

    const stored = await adapter.readLocalRecord('Component', 'C-LWW');
    expect((stored?.fields['status'] as { value: unknown }).value).toBe('closed');
  });

  it('soft-delete via newer-HLC delete', async () => {
    const adapter = new PrismaSyncAdapter(prisma, tenantId, vesselId);
    const hlc1 = '0000000f4260-0000-shore';
    const hlc2 = '0000000f4261-0000-shore';
    await adapter.applyRemoteDelta({
      entityType: 'Component',
      entityId: 'C-DEL',
      operation: 'upsert',
      payload: { name: { value: 'Valve', hlc: hlc1 } },
      hlc: hlc1,
      nodeId: 'shore',
    });
    const result = await adapter.applyRemoteDelta({
      entityType: 'Component',
      entityId: 'C-DEL',
      operation: 'delete',
      payload: null,
      hlc: hlc2,
      nodeId: 'shore',
    });
    expect(result.record.deletedAt).not.toBeNull();
  });

  it('isolates by (tenant, vessel) — other-vessel adapter cannot read', async () => {
    const a = new PrismaSyncAdapter(prisma, tenantId, vesselId);
    const otherVesselId = ulid();
    await prisma.vessel.create({
      data: { id: otherVesselId, tenantId, name: 'other-vessel' },
    });
    try {
      const hlc = '0000000f4270-0000-shore';
      await a.applyRemoteDelta({
        entityType: 'Component',
        entityId: 'C-ISO',
        operation: 'upsert',
        payload: { name: { value: 'Iso', hlc } },
        hlc,
        nodeId: 'shore',
      });

      const b = new PrismaSyncAdapter(prisma, tenantId, otherVesselId);
      expect(await b.readLocalRecord('Component', 'C-ISO')).toBeNull();
    } finally {
      await prisma.syncRecord.deleteMany({ where: { tenantId, vesselId: otherVesselId } });
      await prisma.vessel.delete({ where: { id: otherVesselId } });
    }
  });
});
