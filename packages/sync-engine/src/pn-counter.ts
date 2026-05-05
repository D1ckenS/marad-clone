import { DomainError } from '@marad-clone/domain';

/**
 * PN-Counter CRDT for inventory ROB (Remaining On Board).
 *
 * Each node accumulates its own positive deltas (receipts) and negative deltas
 * (consumptions) in separate per-node buckets. ROB = Σp − Σn.
 *
 * Merge takes the per-node max of each bucket — commutative, associative,
 * idempotent. Concurrent writes from different nodes always converge.
 */
export type PnCounterState = {
  readonly p: Readonly<Record<string, number>>; // positive deltas per nodeId
  readonly n: Readonly<Record<string, number>>; // negative deltas per nodeId
};

export function createPnCounter(): PnCounterState {
  return { p: {}, n: {} };
}

export function pnValue(counter: PnCounterState): number {
  const sumP = Object.values(counter.p).reduce((acc, v) => acc + v, 0);
  const sumN = Object.values(counter.n).reduce((acc, v) => acc + v, 0);
  return sumP - sumN;
}

export function pnIncrement(
  counter: PnCounterState,
  nodeId: string,
  amount: number,
): PnCounterState {
  if (amount <= 0) {
    throw new DomainError('INVALID_INPUT', `pnIncrement amount must be positive, got ${amount}`);
  }
  return {
    p: { ...counter.p, [nodeId]: (counter.p[nodeId] ?? 0) + amount },
    n: counter.n,
  };
}

export function pnDecrement(
  counter: PnCounterState,
  nodeId: string,
  amount: number,
): PnCounterState {
  if (amount <= 0) {
    throw new DomainError('INVALID_INPUT', `pnDecrement amount must be positive, got ${amount}`);
  }
  return {
    p: counter.p,
    n: { ...counter.n, [nodeId]: (counter.n[nodeId] ?? 0) + amount },
  };
}

/**
 * CRDT merge: take the per-node max of both buckets.
 * This is the join operation of the PN-Counter lattice.
 */
export function pnMerge(a: PnCounterState, b: PnCounterState): PnCounterState {
  const pKeys = new Set([...Object.keys(a.p), ...Object.keys(b.p)]);
  const nKeys = new Set([...Object.keys(a.n), ...Object.keys(b.n)]);

  const p: Record<string, number> = {};
  for (const k of pKeys) {
    p[k] = Math.max(a.p[k] ?? 0, b.p[k] ?? 0);
  }

  const n: Record<string, number> = {};
  for (const k of nKeys) {
    n[k] = Math.max(a.n[k] ?? 0, b.n[k] ?? 0);
  }

  return { p, n };
}
