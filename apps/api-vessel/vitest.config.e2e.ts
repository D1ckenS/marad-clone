import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.e2e.ts'],
    env: {
      DATABASE_URL: ':memory:',
      // Vessel auth — cached shore public key (RS256 verification).
      JWT_PUBLIC_KEY_PATH: '../../keys/jwt-public.pem',
      // Tests need to MINT shore-style tokens to exercise verification,
      // so they have access to the matching private key. In production
      // the vessel never sees the private key.
      JWT_PRIVATE_KEY_PATH: '../../keys/jwt-private.pem',
      // Vessel-local password login (legacy / dev path).
      VESSEL_LOCAL_JWT_SECRET: 'test-vessel-local-secret',
      VESSEL_LOCAL_JWT_TTL_MS: '28800000',
      PORT: '3002',
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    forks: { singleFork: true },
  },
});
