import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkRunningHourThresholds } from './running-hour-scheduler.js';

// ── Deterministic unit tests ─────────────────────────────────────────────────

describe('checkRunningHourThresholds — unit', () => {
  it('triggers at exact boundary', () => {
    expect(checkRunningHourThresholds({ intervalHours: 250, prevHours: 0, newHours: 250 })).toEqual(
      [250],
    );
  });

  it('triggers just past boundary', () => {
    expect(checkRunningHourThresholds({ intervalHours: 250, prevHours: 0, newHours: 251 })).toEqual(
      [250],
    );
  });

  it('does not trigger below boundary', () => {
    expect(checkRunningHourThresholds({ intervalHours: 250, prevHours: 0, newHours: 249 })).toEqual(
      [],
    );
  });

  it('triggers multiple boundaries in one large jump', () => {
    expect(checkRunningHourThresholds({ intervalHours: 250, prevHours: 0, newHours: 750 })).toEqual(
      [250, 500, 750],
    );
  });

  it('does not retrigger an already-passed boundary', () => {
    expect(
      checkRunningHourThresholds({ intervalHours: 250, prevHours: 250, newHours: 499 }),
    ).toEqual([]);
  });

  it('triggers at the next boundary after a passed one', () => {
    expect(
      checkRunningHourThresholds({ intervalHours: 250, prevHours: 250, newHours: 500 }),
    ).toEqual([500]);
  });

  it('returns empty when newHours equals prevHours', () => {
    expect(
      checkRunningHourThresholds({ intervalHours: 250, prevHours: 300, newHours: 300 }),
    ).toEqual([]);
  });

  it('returns empty when newHours < prevHours', () => {
    expect(
      checkRunningHourThresholds({ intervalHours: 250, prevHours: 300, newHours: 200 }),
    ).toEqual([]);
  });

  it('returns empty for zero interval', () => {
    expect(checkRunningHourThresholds({ intervalHours: 0, prevHours: 0, newHours: 1000 })).toEqual(
      [],
    );
  });

  it('returns empty for negative interval', () => {
    expect(
      checkRunningHourThresholds({ intervalHours: -100, prevHours: 0, newHours: 1000 }),
    ).toEqual([]);
  });

  it('handles common maritime interval of 250 h from fresh component', () => {
    // Component at 0h, first service at 250h
    expect(
      checkRunningHourThresholds({ intervalHours: 250, prevHours: 0, newHours: 250.5 }),
    ).toEqual([250]);
  });

  it('handles 1000-hour interval crossing two boundaries', () => {
    expect(
      checkRunningHourThresholds({ intervalHours: 1000, prevHours: 500, newHours: 2500 }),
    ).toEqual([1000, 2000]);
  });
});

// ── Property-based tests ─────────────────────────────────────────────────────

describe('checkRunningHourThresholds — properties', () => {
  // Positive finite intervals in a realistic range.
  const interval = fc.float({ min: 0.5, max: 2000, noNaN: true });
  // Running hours bounded to avoid very large loops.
  const hours = fc.float({ min: 0, max: 50_000, noNaN: true });
  const delta = fc.float({ min: 0, max: 10_000, noNaN: true });

  it('count equals floor(new/interval) – floor(prev/interval) when new > prev', () => {
    fc.assert(
      fc.property(interval, hours, delta, (iv, prev, d) => {
        const next = prev + d;
        const result = checkRunningHourThresholds({
          intervalHours: iv,
          prevHours: prev,
          newHours: next,
        });
        const expected = Math.max(0, Math.floor(next / iv) - Math.floor(prev / iv));
        expect(result.length).toBe(expected);
      }),
      { numRuns: 500 },
    );
  }, 15_000);

  it('every threshold is a multiple of intervalHours', () => {
    fc.assert(
      fc.property(interval, hours, delta, (iv, prev, d) => {
        const next = prev + d;
        const result = checkRunningHourThresholds({
          intervalHours: iv,
          prevHours: prev,
          newHours: next,
        });
        for (const t of result) {
          const k = t / iv;
          // k must be very close to an integer (it is k*interval by construction)
          expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-9);
        }
      }),
      { numRuns: 500 },
    );
  }, 15_000);

  it('every threshold is strictly greater than prevHours', () => {
    fc.assert(
      fc.property(interval, hours, delta, (iv, prev, d) => {
        const next = prev + d;
        const result = checkRunningHourThresholds({
          intervalHours: iv,
          prevHours: prev,
          newHours: next,
        });
        for (const t of result) {
          expect(t).toBeGreaterThan(prev);
        }
      }),
      { numRuns: 500 },
    );
  }, 15_000);

  it('every threshold is ≤ newHours', () => {
    fc.assert(
      fc.property(interval, hours, delta, (iv, prev, d) => {
        const next = prev + d;
        const result = checkRunningHourThresholds({
          intervalHours: iv,
          prevHours: prev,
          newHours: next,
        });
        for (const t of result) {
          expect(t).toBeLessThanOrEqual(next + 1e-9);
        }
      }),
      { numRuns: 500 },
    );
  }, 15_000);

  it('result is sorted ascending', () => {
    fc.assert(
      fc.property(interval, hours, delta, (iv, prev, d) => {
        const next = prev + d;
        const result = checkRunningHourThresholds({
          intervalHours: iv,
          prevHours: prev,
          newHours: next,
        });
        for (let i = 1; i < result.length; i++) {
          expect(result[i]).toBeGreaterThan(result[i - 1]!);
        }
      }),
      { numRuns: 500 },
    );
  }, 15_000);

  it('never triggers when newHours ≤ prevHours', () => {
    fc.assert(
      fc.property(interval, hours, (iv, h) => {
        // equal
        expect(
          checkRunningHourThresholds({ intervalHours: iv, prevHours: h, newHours: h }),
        ).toEqual([]);
        // below (clamped to 0 if h is 0)
        if (h > 0) {
          expect(
            checkRunningHourThresholds({
              intervalHours: iv,
              prevHours: h,
              newHours: h * 0.999,
            }),
          ).toEqual([]);
        }
      }),
      { numRuns: 500 },
    );
  }, 15_000);

  it('is a pure function — same inputs always produce identical output', () => {
    fc.assert(
      fc.property(interval, hours, delta, (iv, prev, d) => {
        const next = prev + d;
        const input = { intervalHours: iv, prevHours: prev, newHours: next };
        expect(checkRunningHourThresholds(input)).toEqual(checkRunningHourThresholds(input));
      }),
      { numRuns: 200 },
    );
  }, 10_000);
});
