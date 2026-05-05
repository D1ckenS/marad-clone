import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.e2e.ts'],
    env: {
      DATABASE_URL: ':memory:',
      JWT_SECRET: 'test-secret',
      PORT: '3002',
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    forks: { singleFork: true },
  },
});
