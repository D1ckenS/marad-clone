import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertProductionEnv } from './production-env';

const REQUIRED = [
  'DATABASE_URL',
  'JWT_PRIVATE_KEY_PATH',
  'JWT_PUBLIC_KEY_PATH',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_BUCKET',
  'PLATFORM_BOOTSTRAP_KEY',
];

describe('assertProductionEnv (shore, H2)', () => {
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of [...REQUIRED, 'NODE_ENV']) snapshot[k] = process.env[k];
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

  it('throws when PLATFORM_BOOTSTRAP_KEY is set to a dev default', () => {
    process.env['NODE_ENV'] = 'production';
    for (const k of REQUIRED) process.env[k] = 'set';
    process.env['PLATFORM_BOOTSTRAP_KEY'] = 'dev';
    expect(() => assertProductionEnv()).toThrow(/PLATFORM_BOOTSTRAP_KEY.*dev default/);
  });

  it('passes when everything is set to non-default values', () => {
    process.env['NODE_ENV'] = 'production';
    for (const k of REQUIRED) process.env[k] = `prod-value-for-${k}`;
    expect(() => assertProductionEnv()).not.toThrow();
  });
});
