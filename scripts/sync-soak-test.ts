/**
 * Sync engine soak test — P0-6 baseline + P0-9 wire-protocol verification.
 *
 * Phase 1 (P0-6): in-process bidirectional convergence using direct
 * applyRemoteDelta calls. Validates engine semantics independent of any
 * transport.
 *
 * Phase 2 (P0-9): same workload, but every delta crosses a real gRPC
 * loopback connection between two SyncEngines hosted in-process. Validates
 * the wire protocol — framing, back-pressure, ordering — using the
 * production GrpcSyncTransport / startSyncServer code paths.
 *
 * Exit 0 = both phases pass.  Exit 1 = any failure.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HlcClock } from '@fleetops/domain';
import {
  GrpcSyncTransport,
  InMemoryAdapter,
  SyncEngine,
  createPnCounter,
  pnDecrement,
  pnIncrement,
  pnMerge,
  pnValue,
  startSyncServer,
  type SyncDelta,
} from '@fleetops/sync-engine';

// ── simulation parameters ─────────────────────────────────────────────────────

const HORIZON_MS = 30 * 60 * 1_000; // 30 simulated minutes
const ENTITY_COUNT = 200; // distinct entities on both nodes
const WRITES_PER_NODE = 1_000; // writes each node emits → 1 000 conflicts
const ROB_ENTITY_COUNT = 50; // entities tracked with PN-Counter

// gRPC phase: smaller workload — wire round-trips dominate, want soak to
// stay under a couple of seconds while still exercising hundreds of frames.
const GRPC_WRITES_PER_NODE = 200;
const GRPC_ENTITY_COUNT = 60;

const PROTO_PATH = resolve(
  fileURLToPath(import.meta.url),
  '..',
  '..',
  'packages',
  'proto',
  'sync.proto',
);

// ── clock factory ─────────────────────────────────────────────────────────────

function makeSimClock(
  nodeId: string,
  offsetMs: number,
): { clock: HlcClock; advance: (ms: number) => void } {
  let now = offsetMs;
  const clock = new HlcClock({ nodeId, now: () => now });
  return {
    clock,
    advance(ms: number) {
      now += ms;
    },
  };
}

// ── node factory ──────────────────────────────────────────────────────────────

function makeNode(nodeId: string, offsetMs: number) {
  const { clock, advance } = makeSimClock(nodeId, offsetMs);
  const adapter = new InMemoryAdapter();
  const engine = new SyncEngine(adapter, clock, nodeId);
  return { engine, adapter, advance };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function entityId(i: number): string {
  return `ENTITY-${String(i).padStart(4, '0')}`;
}

function toDelta(e: {
  entityType: string;
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: unknown;
  hlc: string;
  nodeId: string;
}): SyncDelta {
  return {
    entityType: e.entityType,
    entityId: e.entityId,
    operation: e.operation,
    payload: e.payload as SyncDelta['payload'],
    hlc: e.hlc,
    nodeId: e.nodeId,
  };
}

// ── Phase 1: in-process scenario (engine semantics) ───────────────────────────

async function runInProcessScenario(): Promise<{ passed: boolean; errors: string[] }> {
  const errors: string[] = [];

  const vessel = makeNode('vessel', 0);
  const shore = makeNode('shore', HORIZON_MS / 2);

  const timeStep = Math.floor(HORIZON_MS / WRITES_PER_NODE);

  let vesselWrites = 0;
  let shoreWrites = 0;

  for (let i = 0; i < WRITES_PER_NODE; i++) {
    const idx = i % ENTITY_COUNT;
    const eid = entityId(idx);

    vessel.advance(timeStep);
    await vessel.engine.write('Component', eid, {
      status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'maintenance' : 'inactive',
      vesselNote: `vessel-write-${i}`,
      priority: i % 5,
    });
    vesselWrites++;

    shore.advance(timeStep);
    await shore.engine.write('Component', eid, {
      status: i % 2 === 0 ? 'active' : 'standby',
      shoreNote: `shore-write-${i}`,
      category: i % 4,
    });
    shoreWrites++;
  }

  let vesselRob = createPnCounter();
  let shoreRob = createPnCounter();
  for (let i = 0; i < ROB_ENTITY_COUNT; i++) {
    const amount = (i % 10) + 1;
    vesselRob = pnIncrement(vesselRob, 'vessel', amount);
    shoreRob = pnDecrement(shoreRob, 'shore', Math.max(1, amount - 1));
  }
  const robValue = pnValue(pnMerge(vesselRob, shoreRob));
  if (!Number.isFinite(robValue)) {
    errors.push(`ROB value is not finite after merge: ${String(robValue)}`);
  }

  const vesselOutbox = (await vessel.engine.drainOutbox(WRITES_PER_NODE * 2)).map(toDelta);
  const shoreOutbox = (await shore.engine.drainOutbox(WRITES_PER_NODE * 2)).map(toDelta);

  for (const d of shoreOutbox) await vessel.engine.applyRemoteDelta(d);
  for (const d of vesselOutbox) await shore.engine.applyRemoteDelta(d);

  let checkedEntities = 0;
  let divergedEntities = 0;
  for (let i = 0; i < ENTITY_COUNT; i++) {
    const eid = entityId(i);
    const vRec = await vessel.adapter.readLocalRecord('Component', eid);
    const sRec = await shore.adapter.readLocalRecord('Component', eid);
    if (vRec === null || sRec === null) {
      errors.push(`Entity ${eid}: missing on ${vRec === null ? 'vessel' : 'shore'}`);
      divergedEntities++;
      continue;
    }
    const vStatus = (vRec.fields['status'] as { value: unknown } | undefined)?.value;
    const sStatus = (sRec.fields['status'] as { value: unknown } | undefined)?.value;
    if (vStatus !== sStatus) {
      errors.push(
        `Entity ${eid}: status diverged — vessel="${String(vStatus)}" shore="${String(sStatus)}"`,
      );
      divergedEntities++;
    }
    if (!vRec.fields['vesselNote'] || !sRec.fields['vesselNote']) {
      errors.push(`Entity ${eid}: vesselNote missing after sync`);
      divergedEntities++;
    }
    if (!vRec.fields['shoreNote'] || !sRec.fields['shoreNote']) {
      errors.push(`Entity ${eid}: shoreNote missing after sync`);
      divergedEntities++;
    }
    checkedEntities++;
  }
  if (vessel.adapter.pendingCount() !== 0)
    errors.push(`Vessel outbox not empty: ${vessel.adapter.pendingCount()}`);
  if (shore.adapter.pendingCount() !== 0)
    errors.push(`Shore outbox not empty: ${shore.adapter.pendingCount()}`);

  const passed = errors.length === 0;
  console.log('  ─ Phase 1: in-process bidirectional sync ─────────────────');
  console.log(`    vessel writes  : ${vesselWrites}`);
  console.log(`    shore writes   : ${shoreWrites}`);
  console.log(`    entities       : ${checkedEntities} / ${ENTITY_COUNT}`);
  console.log(`    diverged       : ${divergedEntities}`);
  console.log(`    ROB after merge: ${robValue}`);
  console.log(`    result         : ${passed ? 'PASS' : `FAIL (${errors.length})`}`);
  return { passed, errors };
}

// ── Phase 2: gRPC wire scenario ───────────────────────────────────────────────

async function runGrpcScenario(): Promise<{ passed: boolean; errors: string[] }> {
  const errors: string[] = [];

  const vessel = makeNode('vessel', 0);
  const shore = makeNode('shore', HORIZON_MS / 2);

  // Boot a gRPC server on the shore side. Each opened stream binds to the
  // single shore engine for this soak — multi-engine routing on the server
  // is the production responsibility (P0-9 §9 of the ADR).
  let serverApplyRemote: ((d: SyncDelta) => Promise<void>) | null = null;
  let pushToVessel: ((d: SyncDelta) => Promise<void>) | null = null;

  const server = await startSyncServer('127.0.0.1:0', {
    protoPath: PROTO_PATH,
    onStreamOpen: async (_hello, send) => {
      pushToVessel = send;
      const onReceive = async (d: SyncDelta) => {
        await shore.engine.applyRemoteDelta(d);
      };
      serverApplyRemote = onReceive;
      return {
        welcome: { cursors: {}, sessionId: 'soak-session-1' },
        onReceive,
        onClose: async () => {
          serverApplyRemote = null;
          pushToVessel = null;
        },
      };
    },
  });

  const transport = new GrpcSyncTransport({
    protoPath: PROTO_PATH,
    serverAddress: `127.0.0.1:${server.port}`,
    hello: { tenantId: 'soak-tenant', vesselId: 'soak-vessel', nodeId: 'vessel' },
  });

  await transport.start(async (d) => {
    await vessel.engine.applyRemoteDelta(d);
  });

  // Generate workload, draining outboxes through the transport in batches.
  const timeStep = Math.floor(HORIZON_MS / GRPC_WRITES_PER_NODE);
  for (let i = 0; i < GRPC_WRITES_PER_NODE; i++) {
    const eid = entityId(i % GRPC_ENTITY_COUNT);
    vessel.advance(timeStep);
    await vessel.engine.write('Component', eid, {
      status: i % 2 === 0 ? 'active' : 'standby',
      vesselNote: `v-${i}`,
    });
    shore.advance(timeStep);
    await shore.engine.write('Component', eid, {
      status: i % 3 === 0 ? 'active' : 'maintenance',
      shoreNote: `s-${i}`,
    });

    if (i % 25 === 0) {
      // periodic drain: vessel pushes upstream, shore pushes downstream
      const vDeltas = (await vessel.engine.drainOutbox(100)).map(toDelta);
      if (vDeltas.length > 0) await transport.send(vDeltas);
      const sDeltas = (await shore.engine.drainOutbox(100)).map(toDelta);
      for (const d of sDeltas) {
        if (pushToVessel === null) throw new Error('shore stream not bound');
        await pushToVessel(d);
      }
    }
  }

  // Final drain on both sides
  const finalVessel = (await vessel.engine.drainOutbox(GRPC_WRITES_PER_NODE * 2)).map(toDelta);
  if (finalVessel.length > 0) await transport.send(finalVessel);
  const finalShore = (await shore.engine.drainOutbox(GRPC_WRITES_PER_NODE * 2)).map(toDelta);
  for (const d of finalShore) {
    if (pushToVessel === null) throw new Error('shore stream not bound');
    await pushToVessel(d);
  }

  // Drain any pending wire messages by giving the event loop a moment.
  await new Promise((r) => setTimeout(r, 200));

  // Verify convergence
  let checked = 0;
  let diverged = 0;
  for (let i = 0; i < GRPC_ENTITY_COUNT; i++) {
    const eid = entityId(i);
    const vRec = await vessel.adapter.readLocalRecord('Component', eid);
    const sRec = await shore.adapter.readLocalRecord('Component', eid);
    if (vRec === null || sRec === null) {
      errors.push(`gRPC: entity ${eid} missing on ${vRec === null ? 'vessel' : 'shore'}`);
      diverged++;
      continue;
    }
    const vStatus = (vRec.fields['status'] as { value: unknown } | undefined)?.value;
    const sStatus = (sRec.fields['status'] as { value: unknown } | undefined)?.value;
    if (vStatus !== sStatus) {
      errors.push(
        `gRPC: ${eid} status diverged — vessel="${String(vStatus)}" shore="${String(sStatus)}"`,
      );
      diverged++;
    }
    if (!vRec.fields['vesselNote'] || !sRec.fields['vesselNote'])
      errors.push(`gRPC: ${eid} vesselNote missing`);
    if (!vRec.fields['shoreNote'] || !sRec.fields['shoreNote'])
      errors.push(`gRPC: ${eid} shoreNote missing`);
    checked++;
  }

  void serverApplyRemote;
  await transport.close();
  await server.shutdown();

  const passed = errors.length === 0;
  console.log('  ─ Phase 2: gRPC wire (loopback) ──────────────────────────');
  console.log(`    server addr    : 127.0.0.1:${server.port}`);
  console.log(`    writes per side: ${GRPC_WRITES_PER_NODE}`);
  console.log(`    entities       : ${checked} / ${GRPC_ENTITY_COUNT}`);
  console.log(`    diverged       : ${diverged}`);
  console.log(`    result         : ${passed ? 'PASS' : `FAIL (${errors.length})`}`);
  return { passed, errors };
}

// ── entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  FleetOps sync soak test (P0-6 + P0-9)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Simulated horizon : ${HORIZON_MS / 60_000} min`);

  const phase1 = await runInProcessScenario();
  const phase2 = await runGrpcScenario();
  const allErrors = [...phase1.errors, ...phase2.errors];
  const passed = phase1.passed && phase2.passed;

  console.log('───────────────────────────────────────────────────────────');
  if (passed) {
    console.log('  RESULT: PASS — both phases converged, zero data loss');
  } else {
    console.log(`  RESULT: FAIL — ${allErrors.length} error(s)`);
    for (const e of allErrors.slice(0, 20)) console.log(`    ✗ ${e}`);
    if (allErrors.length > 20) console.log(`    … and ${allErrors.length - 20} more`);
  }
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  process.exit(passed ? 0 : 1);
}

await main();
