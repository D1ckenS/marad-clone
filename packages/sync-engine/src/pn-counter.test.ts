import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createPnCounter,
  pnDecrement,
  pnIncrement,
  pnMerge,
  pnValue,
  type PnCounterState,
} from './pn-counter.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function pnStatesEqual(a: PnCounterState, b: PnCounterState): boolean {
  const pKeys = new Set([...Object.keys(a.p), ...Object.keys(b.p)]);
  const nKeys = new Set([...Object.keys(a.n), ...Object.keys(b.n)]);
  for (const k of pKeys) {
    if ((a.p[k] ?? 0) !== (b.p[k] ?? 0)) return false;
  }
  for (const k of nKeys) {
    if ((a.n[k] ?? 0) !== (b.n[k] ?? 0)) return false;
  }
  return true;
}

// fast-check arbitrary: build a PnCounter from a list of (nodeId, +amount) and (nodeId, -amount) ops
const arbPnCounter = fc
  .array(
    fc.record({
      nodeId: fc.constantFrom('vessel', 'shore', 'mobile'),
      op: fc.constantFrom('inc', 'dec') as fc.Arbitrary<'inc' | 'dec'>,
      amount: fc.integer({ min: 1, max: 100 }),
    }),
    { minLength: 0, maxLength: 20 },
  )
  .map((ops) => {
    let state = createPnCounter();
    for (const { nodeId, op, amount } of ops) {
      state =
        op === 'inc' ? pnIncrement(state, nodeId, amount) : pnDecrement(state, nodeId, amount);
    }
    return state;
  });

// ── unit tests ────────────────────────────────────────────────────────────────

describe('pnValue', () => {
  it('is 0 for a fresh counter', () => {
    expect(pnValue(createPnCounter())).toBe(0);
  });

  it('reflects increments', () => {
    const c = pnIncrement(createPnCounter(), 'vessel', 10);
    expect(pnValue(c)).toBe(10);
  });

  it('reflects decrements', () => {
    const c = pnDecrement(pnIncrement(createPnCounter(), 'vessel', 10), 'vessel', 3);
    expect(pnValue(c)).toBe(7);
  });

  it('sums across nodes', () => {
    let c = createPnCounter();
    c = pnIncrement(c, 'vessel', 5);
    c = pnIncrement(c, 'shore', 8);
    c = pnDecrement(c, 'mobile', 2);
    expect(pnValue(c)).toBe(11);
  });
});

describe('pnIncrement / pnDecrement', () => {
  it('pnIncrement throws on non-positive amount', () => {
    expect(() => pnIncrement(createPnCounter(), 'n', 0)).toThrow();
    expect(() => pnIncrement(createPnCounter(), 'n', -1)).toThrow();
  });

  it('pnDecrement throws on non-positive amount', () => {
    expect(() => pnDecrement(createPnCounter(), 'n', 0)).toThrow();
    expect(() => pnDecrement(createPnCounter(), 'n', -5)).toThrow();
  });

  it('does not mutate the original state', () => {
    const original = pnIncrement(createPnCounter(), 'vessel', 10);
    pnIncrement(original, 'shore', 5);
    expect(original.p['shore']).toBeUndefined();
  });
});

describe('pnMerge', () => {
  it('concurrent increments from two nodes sum after merge', () => {
    const vessel = pnIncrement(createPnCounter(), 'vessel', 7);
    const shore = pnIncrement(createPnCounter(), 'shore', 3);
    expect(pnValue(pnMerge(vessel, shore))).toBe(10);
  });

  it('deduplicates identical ops when both replicas applied the same op', () => {
    // Both replicas received the same +5 from vessel (e.g. re-delivered message)
    const a = pnIncrement(createPnCounter(), 'vessel', 5);
    const b = pnIncrement(createPnCounter(), 'vessel', 5);
    // merge should give 5, not 10
    expect(pnValue(pnMerge(a, b))).toBe(5);
  });

  it('concurrent decrement and increment converge correctly', () => {
    const base = pnIncrement(createPnCounter(), 'vessel', 20);
    const sideA = pnDecrement(base, 'vessel', 3); // vessel consumed 3
    const sideB = pnIncrement(base, 'shore', 10); // shore received 10
    const merged = pnMerge(sideA, sideB);
    // vessel.p=20, vessel.n=3, shore.p=10 → 30 - 3 = 27
    expect(pnValue(merged)).toBe(27);
  });
});

// ── property-based tests ──────────────────────────────────────────────────────

describe('pnMerge — CRDT properties', () => {
  it('is commutative: merge(a,b) ≡ merge(b,a)', () => {
    fc.assert(
      fc.property(arbPnCounter, arbPnCounter, (a, b) => {
        expect(pnStatesEqual(pnMerge(a, b), pnMerge(b, a))).toBe(true);
      }),
    );
  });

  it('is associative: merge(a, merge(b,c)) ≡ merge(merge(a,b), c)', () => {
    fc.assert(
      fc.property(arbPnCounter, arbPnCounter, arbPnCounter, (a, b, c) => {
        const left = pnMerge(a, pnMerge(b, c));
        const right = pnMerge(pnMerge(a, b), c);
        expect(pnStatesEqual(left, right)).toBe(true);
      }),
    );
  });

  it('is idempotent: merge(a, a) ≡ a', () => {
    fc.assert(
      fc.property(arbPnCounter, (a) => {
        expect(pnStatesEqual(pnMerge(a, a), a)).toBe(true);
      }),
    );
  });

  it('value is monotonically non-decreasing after merge with a higher-value state', () => {
    fc.assert(
      fc.property(arbPnCounter, fc.integer({ min: 1, max: 50 }), (base, extra) => {
        const extended = pnIncrement(base, 'shore', extra);
        expect(pnValue(pnMerge(base, extended))).toBeGreaterThanOrEqual(pnValue(base));
      }),
    );
  });
});
