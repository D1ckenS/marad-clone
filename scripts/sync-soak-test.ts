/**
 * Sync engine soak test — P0-6 verification.
 *
 * Simulates 30 minutes of vessel+shore activity (fast-forward clock) with
 * 1 000 writes and 1 000 conflicts, then verifies zero data loss after a
 * full bidirectional exchange.
 *
 * Exit 0 = pass.  Exit 1 = fail (prints divergence details).
 */

import { HlcClock } from '@marad-clone/domain';
import {
  InMemoryAdapter,
  SyncEngine,
  createPnCounter,
  pnDecrement,
  pnIncrement,
  pnMerge,
  pnValue,
  type SyncDelta,
} from '@marad-clone/sync-engine';

// ── simulation parameters ─────────────────────────────────────────────────────

const HORIZON_MS = 30 * 60 * 1_000; // 30 simulated minutes
const ENTITY_COUNT = 200; // distinct entities on both nodes
const WRITES_PER_NODE = 1_000; // writes each node emits → 1 000 conflicts
const ROB_ENTITY_COUNT = 50; // entities tracked with PN-Counter

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

// ── scenario ──────────────────────────────────────────────────────────────────

function runScenario(): { passed: boolean; errors: string[] } {
  const errors: string[] = [];

  const vessel = makeNode('vessel', 0);
  const shore = makeNode('shore', HORIZON_MS / 2); // shore clock starts mid-horizon

  const timeStep = Math.floor(HORIZON_MS / WRITES_PER_NODE);

  // ── Phase 1: interleaved writes on both nodes ─────────────────────────────

  let vesselWrites = 0;
  let shoreWrites = 0;

  for (let i = 0; i < WRITES_PER_NODE; i++) {
    const idx = i % ENTITY_COUNT;
    const eid = entityId(idx);

    vessel.advance(timeStep);
    vessel.engine.write('Component', eid, {
      status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'maintenance' : 'inactive',
      vesselNote: `vessel-write-${i}`,
      priority: i % 5,
    });
    vesselWrites++;

    shore.advance(timeStep);
    shore.engine.write('Component', eid, {
      status: i % 2 === 0 ? 'active' : 'standby', // always conflicts with vessel's status
      shoreNote: `shore-write-${i}`,
      category: i % 4,
    });
    shoreWrites++;
  }

  // ── Phase 2: PN-Counter operations (inventory ROB) ────────────────────────

  let vesselRob = createPnCounter();
  let shoreRob = createPnCounter();

  for (let i = 0; i < ROB_ENTITY_COUNT; i++) {
    const amount = (i % 10) + 1;
    vesselRob = pnIncrement(vesselRob, 'vessel', amount); // receipt on vessel
    shoreRob = pnDecrement(shoreRob, 'shore', Math.max(1, amount - 1)); // consumption on shore
  }

  const mergedRob = pnMerge(vesselRob, shoreRob);
  const robValue = pnValue(mergedRob);

  if (!Number.isFinite(robValue)) {
    errors.push(`ROB value is not finite after merge: ${String(robValue)}`);
  }

  // ── Phase 3: bidirectional exchange ──────────────────────────────────────

  const vesselOutbox = vessel.engine.drainOutbox(WRITES_PER_NODE * 2).map(toDelta);
  const shoreOutbox = shore.engine.drainOutbox(WRITES_PER_NODE * 2).map(toDelta);

  for (const d of shoreOutbox) vessel.engine.applyRemoteDelta(d);
  for (const d of vesselOutbox) shore.engine.applyRemoteDelta(d);

  // ── Phase 4: verify convergence ───────────────────────────────────────────

  let checkedEntities = 0;
  let divergedEntities = 0;

  for (let i = 0; i < ENTITY_COUNT; i++) {
    const eid = entityId(i);
    const vRec = vessel.adapter.readLocalRecord('Component', eid);
    const sRec = shore.adapter.readLocalRecord('Component', eid);

    if (vRec === null || sRec === null) {
      errors.push(`Entity ${eid}: missing on ${vRec === null ? 'vessel' : 'shore'}`);
      divergedEntities++;
      continue;
    }

    // Both sides must agree on fields written by the conflicting node (status).
    const vStatus = (vRec.fields['status'] as { value: unknown } | undefined)?.value;
    const sStatus = (sRec.fields['status'] as { value: unknown } | undefined)?.value;
    if (vStatus !== sStatus) {
      errors.push(
        `Entity ${eid}: status diverged — vessel="${String(vStatus)}" shore="${String(sStatus)}"`,
      );
      divergedEntities++;
    }

    // Both sides must have the other node's exclusive fields.
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

  // ── Phase 5: verify outboxes are empty ───────────────────────────────────

  if (vessel.adapter.pendingCount() !== 0) {
    errors.push(`Vessel outbox not empty after drain: ${vessel.adapter.pendingCount()} remaining`);
  }
  if (shore.adapter.pendingCount() !== 0) {
    errors.push(`Shore outbox not empty after drain: ${shore.adapter.pendingCount()} remaining`);
  }

  // ── report ────────────────────────────────────────────────────────────────

  const passed = errors.length === 0;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  marad-clone sync-engine soak test');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Simulated horizon : ${HORIZON_MS / 60_000} min`);
  console.log(`  Vessel writes     : ${vesselWrites}`);
  console.log(`  Shore writes      : ${shoreWrites}`);
  console.log(`  Conflicts         : ${vesselWrites} (all writes target shared entities)`);
  console.log(`  Entities checked  : ${checkedEntities} / ${ENTITY_COUNT}`);
  console.log(`  Entities diverged : ${divergedEntities}`);
  console.log(`  ROB after merge   : ${robValue}`);
  console.log('───────────────────────────────────────────────────────────');

  if (passed) {
    console.log('  RESULT: PASS — zero data loss, full convergence');
  } else {
    console.log(`  RESULT: FAIL — ${errors.length} error(s)`);
    for (const e of errors.slice(0, 20)) {
      console.log(`    ✗ ${e}`);
    }
    if (errors.length > 20) {
      console.log(`    … and ${errors.length - 20} more`);
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  return { passed, errors };
}

// ── entry point ───────────────────────────────────────────────────────────────

const { passed } = runScenario();
process.exit(passed ? 0 : 1);
