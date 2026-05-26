import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertProductionEnv } from './production-env';

const REQUIRED = ['DATABASE_URL', 'JWT_PUBLIC_KEY_PATH', 'VESSEL_LOCAL_JWT_SECRET'];

describe('assertProductionEnv (vessel, H2)', () => {
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of [...REQUIRED, 'VESSEL_BOOTSTRAP_KEY', 'NODE_ENV']) {
      snapshot[k] = process.env[k];
    }
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(snapshot)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('is a no-op when NODE_ENV !== production', () => {
    process.env['NODE_ENV'] = 'development';
    for (const k of REQUIRED) delete process.env[k];
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it('throws listing all missing keys in production', () => {
    process.env['NODE_ENV'] = 'production';
    for (const k of REQUIRED) delete process.env[k];
    expect(() => assertProductionEnv()).toThrow(/missing required env/i);
    try {
      assertProductionEnv();
    } catch (err) {
      const msg = (err as Error).message;
      for (const k of REQUIRED) expect(msg).toContain(k);
    }
  });

  it('throws when VESSEL_LOCAL_JWT_SECRET is set to the historical dev default', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = '/tmp/vessel.db';
    process.env['JWT_PUBLIC_KEY_PATH'] = '/etc/keys/jwt-public.pem';
    process.env['VESSEL_LOCAL_JWT_SECRET'] = 'vessel-local-dev-secret-change-me';
    expect(() => assertProductionEnv()).toThrow(/VESSEL_LOCAL_JWT_SECRET.*dev default/);
  });

  it('passes when everything is set to non-default values', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = '/tmp/vessel.db';
    process.env['JWT_PUBLIC_KEY_PATH'] = '/etc/keys/jwt-public.pem';
    process.env['VESSEL_LOCAL_JWT_SECRET'] = 'a-strong-secret-of-32-chars-or-more';
    expect(() => assertProductionEnv()).not.toThrow();
  });
});
