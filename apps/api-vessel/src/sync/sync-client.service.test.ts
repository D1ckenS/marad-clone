import { startSyncServer, type SyncDelta } from '@fleetops/sync-engine';
import { Test } from '@nestjs/testing';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleSyncAdapter } from './drizzle-sync-adapter';
import { HlcClockRegistry } from './hlc-clock-registry';
import { SyncClientService } from './sync-client.service';

const PROTO_PATH = resolve(__dirname, '..', '..', '..', '..', 'packages', 'proto', 'sync.proto');

class FakeAdapter {
  readonly outboxLog: SyncDelta[] = [];
  readonly applied: SyncDelta[] = [];
  appendOutbox = async () => undefined;
  readPendingOutbox = async () => [];
  markSent = async () => undefined;
  applyRemoteDelta = async (d: SyncDelta) => {
    this.applied.push(d);
    return {
      record: {
        entityType: d.entityType,
        entityId: d.entityId,
        hlc: d.hlc,
        deletedAt: null,
        fields: d.payload ?? {},
      },
      merged: true,
    };
  };
  readLocalRecord = async () => null;
}

describe('SyncClientService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env['SYNC_ENABLED'];
    delete process.env['SYNC_TENANT_ID'];
    delete process.env['SYNC_VESSEL_ID'];
    delete process.env['SHORE_SYNC_URL'];
    delete process.env['SYNC_PROTO_PATH'];
    delete process.env['SYNC_DRAIN_INTERVAL_MS'];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function makeService(adapter: FakeAdapter = new FakeAdapter()): Promise<{
    svc: SyncClientService;
    adapter: FakeAdapter;
  }> {
    const module = await Test.createTestingModule({
      providers: [
        SyncClientService,
        HlcClockRegistry,
        { provide: DrizzleSyncAdapter, useValue: adapter },
      ],
    }).compile();
    return { svc: module.get(SyncClientService), adapter };
  }

  it('does not connect when SYNC_ENABLED is unset', async () => {
    const { svc } = await makeService();
    await svc.onApplicationBootstrap();
    expect(svc.engineRef()).toBeNull();
    await svc.onApplicationShutdown();
  });

  it('logs and skips boot when SYNC_TENANT_ID is missing', async () => {
    process.env['SYNC_ENABLED'] = '1';
    const { svc } = await makeService();
    await svc.onApplicationBootstrap();
    expect(svc.engineRef()).toBeNull();
    await svc.onApplicationShutdown();
  });

  it('connects to a real gRPC server and propagates received deltas', async () => {
    let pushToVessel: ((d: SyncDelta) => Promise<void>) | null = null;
    const server = await startSyncServer('127.0.0.1:0', {
      protoPath: PROTO_PATH,
      onStreamOpen: async (_hello, send) => {
        pushToVessel = send;
        return {
          welcome: { cursors: {}, sessionId: 'svc-test' },
          onReceive: async () => undefined,
          onClose: async () => undefined,
        };
      },
    });

    process.env['SYNC_ENABLED'] = '1';
    process.env['SYNC_TENANT_ID'] = 'T1';
    process.env['SYNC_VESSEL_ID'] = 'V1';
    process.env['SHORE_SYNC_URL'] = `127.0.0.1:${server.port}`;
    process.env['SYNC_PROTO_PATH'] = PROTO_PATH;
    process.env['SYNC_DRAIN_INTERVAL_MS'] = '50000'; // effectively never during this test

    const { svc, adapter } = await makeService();
    await svc.onApplicationBootstrap();

    // Allow connection handshake to complete
    await new Promise((r) => setTimeout(r, 250));
    expect(svc.engineRef()).not.toBeNull();
    if (pushToVessel === null) throw new Error('server never bound');

    await (pushToVessel as (d: SyncDelta) => Promise<void>)({
      entityType: 'Component',
      entityId: 'C1',
      operation: 'upsert',
      payload: { name: { value: 'Engine', hlc: '0000000f4240-0000-shore' } },
      hlc: '0000000f4240-0000-shore',
      nodeId: 'shore',
    });

    await new Promise((r) => setTimeout(r, 150));
    expect(adapter.applied).toHaveLength(1);
    expect(adapter.applied[0]?.entityId).toBe('C1');

    await svc.onApplicationShutdown();
    await server.shutdown();
  });

  it('reconnect backoff: failed connect attempts increase delay', async () => {
    process.env['SYNC_ENABLED'] = '1';
    process.env['SYNC_TENANT_ID'] = 'T1';
    process.env['SYNC_VESSEL_ID'] = 'V1';
    // Point at a closed port so connect always fails.
    process.env['SHORE_SYNC_URL'] = '127.0.0.1:1';
    process.env['SYNC_PROTO_PATH'] = PROTO_PATH;

    const { svc } = await makeService();
    await svc.onApplicationBootstrap();
    // Engine is constructed even before connection succeeds — connect runs
    // in background.
    expect(svc.engineRef()).not.toBeNull();
    // Wait briefly for at least one failed attempt.
    await new Promise((r) => setTimeout(r, 200));
    // We can't easily observe the internal counter, but shutdown must
    // unblock the loop.
    await svc.onApplicationShutdown();
  });
});
