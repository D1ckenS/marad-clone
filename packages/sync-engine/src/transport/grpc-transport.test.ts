import { HlcClock } from '@marad-clone/domain';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SyncEngine } from '../engine.js';
import { InMemoryAdapter } from '../in-memory-adapter.js';
import type { SyncDelta } from '../types.js';
import { GrpcSyncTransport, startSyncServer } from './grpc-transport.js';

const PROTO_PATH = resolve(
  fileURLToPath(import.meta.url),
  '..',
  '..',
  '..',
  '..',
  'proto',
  'sync.proto',
);

describe('GrpcSyncTransport — end-to-end wire roundtrip', () => {
  let cleanup: (() => Promise<void>)[] = [];

  beforeEach(() => {
    cleanup = [];
  });

  afterEach(async () => {
    for (const fn of cleanup.reverse()) await fn();
  });

  it('Hello/Welcome handshake completes', async () => {
    const server = await startSyncServer('127.0.0.1:0', {
      protoPath: PROTO_PATH,
      onStreamOpen: async (_hello, _send) => ({
        welcome: { cursors: { shore: 'cursor-A' }, sessionId: 'sess-1' },
        onReceive: async () => undefined,
        onClose: async () => undefined,
      }),
    });
    cleanup.push(() => server.shutdown());

    const transport = new GrpcSyncTransport({
      protoPath: PROTO_PATH,
      serverAddress: `127.0.0.1:${server.port}`,
      hello: { tenantId: 'T1', vesselId: 'V1', nodeId: 'vessel' },
    });
    cleanup.push(() => transport.close());

    await expect(transport.start(async () => undefined)).resolves.toBeUndefined();
  });

  it('vessel→shore delta flows through the wire', async () => {
    const received: SyncDelta[] = [];
    const server = await startSyncServer('127.0.0.1:0', {
      protoPath: PROTO_PATH,
      onStreamOpen: async () => ({
        welcome: { cursors: {}, sessionId: 'sess-A' },
        onReceive: async (d: SyncDelta) => {
          received.push(d);
        },
        onClose: async () => undefined,
      }),
    });
    cleanup.push(() => server.shutdown());

    const transport = new GrpcSyncTransport({
      protoPath: PROTO_PATH,
      serverAddress: `127.0.0.1:${server.port}`,
      hello: { tenantId: 'T1', vesselId: 'V1', nodeId: 'vessel' },
    });
    cleanup.push(() => transport.close());

    await transport.start(async () => undefined);

    const delta: SyncDelta = {
      entityType: 'Component',
      entityId: 'C1',
      operation: 'upsert',
      payload: { name: { value: 'Pump', hlc: '0000000f4240-0000-vessel' } },
      hlc: '0000000f4240-0000-vessel',
      nodeId: 'vessel',
    };
    await transport.send([delta]);

    // Allow the wire round-trip to drain.
    await new Promise((r) => setTimeout(r, 100));
    expect(received).toHaveLength(1);
    expect(received[0]?.entityId).toBe('C1');
    expect(received[0]?.operation).toBe('upsert');
    expect((received[0]?.payload?.['name'] as { value: unknown }).value).toBe('Pump');
  });

  it('shore→vessel delta flows through the wire', async () => {
    let serverSend: ((d: SyncDelta) => Promise<void>) | null = null;
    const server = await startSyncServer('127.0.0.1:0', {
      protoPath: PROTO_PATH,
      onStreamOpen: async (_hello, send) => {
        serverSend = send;
        return {
          welcome: { cursors: {}, sessionId: 'sess-B' },
          onReceive: async () => undefined,
          onClose: async () => undefined,
        };
      },
    });
    cleanup.push(() => server.shutdown());

    const received: SyncDelta[] = [];
    const transport = new GrpcSyncTransport({
      protoPath: PROTO_PATH,
      serverAddress: `127.0.0.1:${server.port}`,
      hello: { tenantId: 'T1', vesselId: 'V1', nodeId: 'vessel' },
    });
    cleanup.push(() => transport.close());

    await transport.start(async (d) => {
      received.push(d);
    });

    if (serverSend === null) throw new Error('server not bound');
    await (serverSend as (d: SyncDelta) => Promise<void>)({
      entityType: 'Component',
      entityId: 'C2',
      operation: 'upsert',
      payload: { name: { value: 'Valve', hlc: '0000000f4240-0000-shore' } },
      hlc: '0000000f4240-0000-shore',
      nodeId: 'shore',
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(received).toHaveLength(1);
    expect(received[0]?.entityId).toBe('C2');
  });

  it('two-engine bidi: convergence over real wire', async () => {
    let t = 0;
    const vesselClock = new HlcClock({ nodeId: 'vessel', now: () => ++t });
    const shoreClock = new HlcClock({ nodeId: 'shore', now: () => ++t });
    const vesselAdapter = new InMemoryAdapter();
    const shoreAdapter = new InMemoryAdapter();
    const vesselEngine = new SyncEngine(vesselAdapter, vesselClock, 'vessel');
    const shoreEngine = new SyncEngine(shoreAdapter, shoreClock, 'shore');

    let pushToVessel: ((d: SyncDelta) => Promise<void>) | null = null;
    const server = await startSyncServer('127.0.0.1:0', {
      protoPath: PROTO_PATH,
      onStreamOpen: async (_hello, send) => {
        pushToVessel = send;
        return {
          welcome: { cursors: {}, sessionId: 'sess-bidi' },
          onReceive: async (d: SyncDelta) => {
            await shoreEngine.applyRemoteDelta(d);
          },
          onClose: async () => undefined,
        };
      },
    });
    cleanup.push(() => server.shutdown());

    const transport = new GrpcSyncTransport({
      protoPath: PROTO_PATH,
      serverAddress: `127.0.0.1:${server.port}`,
      hello: { tenantId: 'T1', vesselId: 'V1', nodeId: 'vessel' },
    });
    cleanup.push(() => transport.close());

    await transport.start(async (d) => {
      await vesselEngine.applyRemoteDelta(d);
    });

    await vesselEngine.write('Component', 'C1', { name: 'Engine', source: 'vessel' });
    await shoreEngine.write('Component', 'C1', { status: 'active', source: 'shore' });

    // Drain vessel outbox over the wire
    const vDeltas = (await vesselEngine.drainOutbox(10)).map(
      (e): SyncDelta => ({
        entityType: e.entityType,
        entityId: e.entityId,
        operation: e.operation,
        payload: e.payload,
        hlc: e.hlc,
        nodeId: e.nodeId,
      }),
    );
    await transport.send(vDeltas);

    // Drain shore outbox via the server's send hook
    const sDeltas = (await shoreEngine.drainOutbox(10)).map(
      (e): SyncDelta => ({
        entityType: e.entityType,
        entityId: e.entityId,
        operation: e.operation,
        payload: e.payload,
        hlc: e.hlc,
        nodeId: e.nodeId,
      }),
    );
    if (pushToVessel === null) throw new Error('server not bound');
    for (const d of sDeltas) {
      await (pushToVessel as (d: SyncDelta) => Promise<void>)(d);
    }

    await new Promise((r) => setTimeout(r, 150));

    const vRec = await vesselAdapter.readLocalRecord('Component', 'C1');
    const sRec = await shoreAdapter.readLocalRecord('Component', 'C1');
    expect(vRec?.fields['name']).toBeDefined();
    expect(vRec?.fields['status']).toBeDefined();
    expect(sRec?.fields['name']).toBeDefined();
    expect(sRec?.fields['status']).toBeDefined();
  });
});
