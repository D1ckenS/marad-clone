import { encodeHlc } from '@fleetops/domain';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compareEncodedHlc, mergeFields } from './lww.js';
import type { LwwRecord } from './types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeHlc(ms: number, counter: number, nodeId: string): string {
  return encodeHlc({ physicalMs: ms, counter, nodeId });
}

// fast-check arbitrary for a single encoded HLC string
const arbHlcString = fc
  .tuple(
    fc.integer({ min: 1, max: 0xffffffffffff }),
    fc.integer({ min: 0, max: 0xffff }),
    fc.stringMatching(/^[a-z]{1,8}$/),
  )
  .map(([ms, counter, nodeId]) => makeHlc(ms, counter, nodeId));

// fast-check arbitrary for a small LwwRecord (1–4 fields)
const arbLwwRecord = fc
  .array(
    fc.tuple(fc.stringMatching(/^[a-z]{1,6}$/), fc.integer({ min: 1, max: 99 }), arbHlcString),
    { minLength: 1, maxLength: 4 },
  )
  .map((pairs) => {
    const rec: LwwRecord = {};
    for (const [field, value, hlc] of pairs) {
      rec[field] = { value, hlc };
    }
    return rec;
  });

// ── unit tests ────────────────────────────────────────────────────────────────

describe('compareEncodedHlc', () => {
  it('returns -1 when a < b by physicalMs', () => {
    expect(compareEncodedHlc(makeHlc(100, 0, 'n'), makeHlc(200, 0, 'n'))).toBe(-1);
  });

  it('returns 1 when a > b by physicalMs', () => {
    expect(compareEncodedHlc(makeHlc(200, 0, 'n'), makeHlc(100, 0, 'n'))).toBe(1);
  });

  it('breaks ties by counter', () => {
    expect(compareEncodedHlc(makeHlc(100, 1, 'n'), makeHlc(100, 0, 'n'))).toBe(1);
  });

  it('breaks ties by nodeId (deterministic)', () => {
    expect(compareEncodedHlc(makeHlc(100, 0, 'b'), makeHlc(100, 0, 'a'))).toBe(1);
    expect(compareEncodedHlc(makeHlc(100, 0, 'a'), makeHlc(100, 0, 'b'))).toBe(-1);
  });

  it('returns 0 for equal HLCs', () => {
    const h = makeHlc(100, 5, 'node');
    expect(compareEncodedHlc(h, h)).toBe(0);
  });
});

describe('mergeFields', () => {
  it('remote field wins when its HLC is newer', () => {
    const base: LwwRecord = { status: { value: 'open', hlc: makeHlc(100, 0, 'vessel') } };
    const incoming: LwwRecord = { status: { value: 'closed', hlc: makeHlc(200, 0, 'shore') } };
    const { record, changed } = mergeFields(base, incoming);
    expect((record['status'] as { value: unknown }).value).toBe('closed');
    expect(changed).toBe(true);
  });

  it('base field wins when its HLC is newer', () => {
    const base: LwwRecord = { status: { value: 'closed', hlc: makeHlc(200, 0, 'vessel') } };
    const incoming: LwwRecord = { status: { value: 'open', hlc: makeHlc(100, 0, 'shore') } };
    const { record, changed } = mergeFields(base, incoming);
    expect((record['status'] as { value: unknown }).value).toBe('closed');
    expect(changed).toBe(false);
  });

  it('adds new fields from incoming', () => {
    const base: LwwRecord = { name: { value: 'Engine', hlc: makeHlc(100, 0, 'vessel') } };
    const incoming: LwwRecord = { notes: { value: 'checked', hlc: makeHlc(150, 0, 'shore') } };
    const { record, changed } = mergeFields(base, incoming);
    expect(record['name']).toBeDefined();
    expect(record['notes']).toBeDefined();
    expect(changed).toBe(true);
  });

  it('does not modify fields absent from incoming', () => {
    const base: LwwRecord = {
      name: { value: 'Engine', hlc: makeHlc(100, 0, 'vessel') },
      status: { value: 'open', hlc: makeHlc(100, 0, 'vessel') },
    };
    const incoming: LwwRecord = { status: { value: 'closed', hlc: makeHlc(200, 0, 'shore') } };
    const { record } = mergeFields(base, incoming);
    expect((record['name'] as { value: unknown }).value).toBe('Engine');
  });

  it('changed=false when incoming is a strict subset with older HLCs', () => {
    const base: LwwRecord = { x: { value: 1, hlc: makeHlc(200, 0, 'n') } };
    const incoming: LwwRecord = { x: { value: 2, hlc: makeHlc(100, 0, 'n') } };
    const { changed } = mergeFields(base, incoming);
    expect(changed).toBe(false);
  });
});

// ── property-based tests ──────────────────────────────────────────────────────

describe('mergeFields — properties', () => {
  it('is idempotent: merge(A, A) ≡ A', () => {
    fc.assert(
      fc.property(arbLwwRecord, (rec) => {
        const { record: result, changed } = mergeFields(rec, rec);
        expect(changed).toBe(false);
        for (const field of Object.keys(rec)) {
          expect(result[field]).toEqual(rec[field]);
        }
      }),
    );
  });

  it('is commutative: same winner regardless of argument order', () => {
    fc.assert(
      fc.property(arbLwwRecord, arbLwwRecord, (a, b) => {
        const { record: ab } = mergeFields(a, b);
        const { record: ba } = mergeFields(b, a);
        // For every field present in both, the winner should be the same value.
        const sharedFields = Object.keys(ab).filter((k) => k in ba);
        for (const field of sharedFields) {
          expect((ab[field] as { value: unknown }).value).toEqual(
            (ba[field] as { value: unknown }).value,
          );
        }
      }),
    );
  });

  it('never loses a field: result contains all fields from both sides', () => {
    fc.assert(
      fc.property(arbLwwRecord, arbLwwRecord, (a, b) => {
        const { record } = mergeFields(a, b);
        for (const field of [...Object.keys(a), ...Object.keys(b)]) {
          expect(record[field]).toBeDefined();
        }
      }),
    );
  });
});
