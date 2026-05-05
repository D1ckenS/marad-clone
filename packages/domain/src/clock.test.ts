import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { HlcClock, compareHlc, decodeHlc, encodeHlc, type Hlc } from './clock.js';

describe('encodeHlc / decodeHlc', () => {
  it('round-trips a basic HLC', () => {
    const hlc: Hlc = { physicalMs: 1700000000000, counter: 5, nodeId: 'node-a' };
    const s = encodeHlc(hlc);
    expect(s).toMatch(/^[0-9a-f]{12}-[0-9a-f]{4}-node-a$/);
    expect(decodeHlc(s)).toEqual(hlc);
  });

  it('zero-pads ms and counter for sortability', () => {
    expect(encodeHlc({ physicalMs: 1, counter: 0, nodeId: 'n' })).toBe('000000000001-0000-n');
  });

  it('rejects out-of-range physicalMs', () => {
    expect(() => encodeHlc({ physicalMs: -1, counter: 0, nodeId: 'n' })).toThrow(DomainError);
    expect(() => encodeHlc({ physicalMs: 0xffffffffffff + 1, counter: 0, nodeId: 'n' })).toThrow(
      DomainError,
    );
    expect(() => encodeHlc({ physicalMs: 1.5, counter: 0, nodeId: 'n' })).toThrow(DomainError);
  });

  it('rejects out-of-range counter', () => {
    expect(() => encodeHlc({ physicalMs: 0, counter: -1, nodeId: 'n' })).toThrow(DomainError);
    expect(() => encodeHlc({ physicalMs: 0, counter: 0x10000, nodeId: 'n' })).toThrow(DomainError);
    expect(() => encodeHlc({ physicalMs: 0, counter: 1.5, nodeId: 'n' })).toThrow(DomainError);
  });

  it('rejects empty nodeId on encode', () => {
    expect(() => encodeHlc({ physicalMs: 0, counter: 0, nodeId: '' })).toThrow(DomainError);
  });

  it('rejects malformed HLC strings on decode', () => {
    expect(() => decodeHlc('garbage')).toThrow(DomainError);
    expect(() => decodeHlc('zzzzzzzzzzzz-0000-n')).toThrow(DomainError);
    expect(() => decodeHlc('000000000000-0000-')).toThrow(DomainError);
  });

  it('preserves lexical sort order matching numerical order', () => {
    const a: Hlc = { physicalMs: 100, counter: 0, nodeId: 'a' };
    const b: Hlc = { physicalMs: 100, counter: 1, nodeId: 'a' };
    const c: Hlc = { physicalMs: 101, counter: 0, nodeId: 'a' };
    const encoded = [a, b, c].map(encodeHlc);
    expect([...encoded].sort()).toEqual(encoded);
  });
});

describe('compareHlc', () => {
  const base: Hlc = { physicalMs: 100, counter: 0, nodeId: 'a' };

  it('orders by physicalMs first', () => {
    expect(compareHlc(base, { ...base, physicalMs: 101 })).toBe(-1);
    expect(compareHlc({ ...base, physicalMs: 99 }, base)).toBe(-1);
  });

  it('breaks ties by counter', () => {
    expect(compareHlc(base, { ...base, counter: 1 })).toBe(-1);
    expect(compareHlc({ ...base, counter: 5 }, { ...base, counter: 5 })).toBe(0);
  });

  it('breaks remaining ties by nodeId', () => {
    expect(compareHlc(base, { ...base, nodeId: 'b' })).toBe(-1);
    expect(compareHlc({ ...base, nodeId: 'b' }, base)).toBe(1);
  });

  it('returns 0 for identical HLCs', () => {
    expect(compareHlc(base, { ...base })).toBe(0);
  });
});

describe('HlcClock.send', () => {
  it('produces strictly increasing HLCs', () => {
    let t = 1000;
    const clock = new HlcClock({ nodeId: 'a', now: () => t });
    const a = clock.send();
    const b = clock.send(); // same wall ms → counter bumps
    t = 1001;
    const c = clock.send();
    expect(compareHlc(a, b)).toBe(-1);
    expect(compareHlc(b, c)).toBe(-1);
    expect(b.counter).toBe(1);
    expect(c.counter).toBe(0);
  });

  it('throws on counter overflow within a single ms', () => {
    const clock = new HlcClock({ nodeId: 'a', now: () => 1000 });
    for (let i = 0; i <= 0xffff; i++) clock.send();
    expect(() => clock.send()).toThrow(DomainError);
  });

  it('handles wall clock going backwards (clamps to last physicalMs)', () => {
    let t = 1000;
    const clock = new HlcClock({ nodeId: 'a', now: () => t });
    clock.send();
    t = 999;
    const next = clock.send();
    expect(next.physicalMs).toBe(1000);
    expect(next.counter).toBe(1);
  });
});

describe('HlcClock.receive', () => {
  it('advances physicalMs to max(local, remote, wall)', () => {
    let t = 1000;
    const clock = new HlcClock({ nodeId: 'a', now: () => t });
    clock.send();
    t = 1005;
    const next = clock.receive({ physicalMs: 1010, counter: 3, nodeId: 'b' });
    expect(next.physicalMs).toBe(1010);
    expect(next.counter).toBe(4);
  });

  it('bumps counter to max(local,remote)+1 when wall == local == remote', () => {
    const clock = new HlcClock({ nodeId: 'a', now: () => 1000 });
    clock.send();
    const next = clock.receive({ physicalMs: 1000, counter: 0, nodeId: 'b' });
    expect(next.physicalMs).toBe(1000);
    expect(next.counter).toBe(1);
  });

  it('uses local counter when local physicalMs wins', () => {
    let t = 1010;
    const clock = new HlcClock({ nodeId: 'a', now: () => t });
    clock.send();
    t = 1005;
    const next = clock.receive({ physicalMs: 1005, counter: 99, nodeId: 'b' });
    expect(next.physicalMs).toBe(1010);
    expect(next.counter).toBe(1);
  });

  it('uses remote counter when remote physicalMs wins', () => {
    let t = 1000;
    const clock = new HlcClock({ nodeId: 'a', now: () => t });
    clock.send();
    t = 1000;
    const next = clock.receive({ physicalMs: 1010, counter: 7, nodeId: 'b' });
    expect(next.physicalMs).toBe(1010);
    expect(next.counter).toBe(8);
  });

  it('resets counter to 0 when wall clock leads everything', () => {
    let t = 1000;
    const clock = new HlcClock({ nodeId: 'a', now: () => t });
    clock.send();
    t = 2000;
    const next = clock.receive({ physicalMs: 1500, counter: 99, nodeId: 'b' });
    expect(next.physicalMs).toBe(2000);
    expect(next.counter).toBe(0);
  });

  it('throws on counter overflow during receive', () => {
    const clock = new HlcClock({ nodeId: 'a', now: () => 1000 });
    for (let i = 0; i <= 0xffff; i++) clock.send();
    expect(() => clock.receive({ physicalMs: 1000, counter: 0, nodeId: 'b' })).toThrow(DomainError);
  });
});

describe('HlcClock.current', () => {
  it('returns the most-recent HLC without advancing it', () => {
    const clock = new HlcClock({ nodeId: 'a', now: () => 1000 });
    const a = clock.send();
    expect(clock.current()).toEqual(a);
    expect(clock.current()).toEqual(a);
  });
});

describe('HlcClock construction', () => {
  it('rejects empty nodeId', () => {
    expect(() => new HlcClock({ nodeId: '' })).toThrow(DomainError);
  });

  it('uses Date.now by default', () => {
    const clock = new HlcClock({ nodeId: 'a' });
    const before = Date.now();
    const hlc = clock.send();
    const after = Date.now();
    expect(hlc.physicalMs).toBeGreaterThanOrEqual(before);
    expect(hlc.physicalMs).toBeLessThanOrEqual(after);
  });
});
