import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { asUlid, idTimestampMs, isUlid, newId, nonMonotonicUlid } from './ids.js';

describe('newId', () => {
  it('produces a 26-character Crockford-base32 ULID', () => {
    const id = newId();
    expect(id).toHaveLength(26);
    expect(isUlid(id)).toBe(true);
  });

  it('produces monotonically increasing IDs across many calls', () => {
    const ids = Array.from({ length: 1000 }, () => newId());
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('encodes the current timestamp', () => {
    const before = Date.now();
    const id = newId();
    const after = Date.now();
    const ts = idTimestampMs(id);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

describe('isUlid', () => {
  it('accepts valid ULIDs', () => {
    expect(isUlid('01HMVB9V8XQ5HJZBPN5MWA8VVB')).toBe(true);
    expect(isUlid(newId())).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isUlid('01HMVB9V8XQ5HJZBPN5MWA8VV')).toBe(false);
    expect(isUlid('01HMVB9V8XQ5HJZBPN5MWA8VVBB')).toBe(false);
    expect(isUlid('')).toBe(false);
  });

  it('rejects ambiguous characters (Crockford base32 omits I, L, O, U)', () => {
    expect(isUlid('I1234567890123456789012345')).toBe(false);
    expect(isUlid('L1234567890123456789012345')).toBe(false);
    expect(isUlid('O1234567890123456789012345')).toBe(false);
    expect(isUlid('U1234567890123456789012345')).toBe(false);
  });

  it('rejects lowercase', () => {
    expect(isUlid('01hmvb9v8xq5hjzbpn5mwa8vvb')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isUlid(123)).toBe(false);
    expect(isUlid(null)).toBe(false);
    expect(isUlid(undefined)).toBe(false);
    expect(isUlid({})).toBe(false);
  });
});

describe('asUlid', () => {
  it('returns a valid ULID unchanged', () => {
    const valid = newId();
    expect(asUlid(valid as string)).toBe(valid);
  });

  it('throws DomainError with INVALID_INPUT on bad input', () => {
    expect(() => asUlid('not-a-ulid')).toThrow(DomainError);
    try {
      asUlid('not-a-ulid');
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('INVALID_INPUT');
    }
  });
});

describe('nonMonotonicUlid', () => {
  it('produces valid ULIDs (without monotonic guarantee)', () => {
    const id = nonMonotonicUlid();
    expect(isUlid(id)).toBe(true);
  });
});
