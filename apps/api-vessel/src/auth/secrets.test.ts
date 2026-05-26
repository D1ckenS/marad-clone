import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { requireVesselJwtSecret } from './secrets';

describe('requireVesselJwtSecret (B2)', () => {
  const original = process.env['VESSEL_LOCAL_JWT_SECRET'];

  beforeEach(() => {
    delete process.env['VESSEL_LOCAL_JWT_SECRET'];
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env['VESSEL_LOCAL_JWT_SECRET'];
    } else {
      process.env['VESSEL_LOCAL_JWT_SECRET'] = original;
    }
  });

  it('throws when unset', () => {
    expect(() => requireVesselJwtSecret()).toThrow(/required/i);
  });

  it('throws when empty', () => {
    process.env['VESSEL_LOCAL_JWT_SECRET'] = '   ';
    expect(() => requireVesselJwtSecret()).toThrow(/required/i);
  });

  it('throws when set to the historical dev default', () => {
    process.env['VESSEL_LOCAL_JWT_SECRET'] = 'vessel-local-dev-secret-change-me';
    expect(() => requireVesselJwtSecret()).toThrow(/dev default/i);
  });

  it('throws when shorter than 32 chars', () => {
    process.env['VESSEL_LOCAL_JWT_SECRET'] = 'short-secret-only-20';
    expect(() => requireVesselJwtSecret()).toThrow(/at least 32/i);
  });

  it('returns the secret when ≥32 chars and not the dev default', () => {
    const strong = 'a'.repeat(32);
    process.env['VESSEL_LOCAL_JWT_SECRET'] = strong;
    expect(requireVesselJwtSecret()).toBe(strong);
  });
});
