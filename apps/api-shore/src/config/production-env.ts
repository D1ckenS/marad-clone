/**
 * Production env guard for api-shore (H2).
 *
 * Refuses to boot in production if any required secret is missing or still
 * set to a known dev default. Skipped entirely when NODE_ENV !== 'production'
 * so local dev + test runs are unaffected.
 *
 * Called once from bootstrap() before NestFactory.create.
 */
export function assertProductionEnv(): void {
  if (process.env['NODE_ENV'] !== 'production') return;

  const required = [
    'DATABASE_URL',
    'JWT_PRIVATE_KEY_PATH',
    'JWT_PUBLIC_KEY_PATH',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_BUCKET',
    'PLATFORM_BOOTSTRAP_KEY',
  ] as const;

  const missing = required.filter((k) => {
    const v = process.env[k];
    return v === undefined || v.trim() === '';
  });
  if (missing.length > 0) {
    throw new Error(
      `Refusing to boot api-shore in production — missing required env: ${missing.join(', ')}`,
    );
  }

  // Known dev-default values that must never reach production.
  const dangerousDevDefaults: Record<string, string[]> = {
    PLATFORM_BOOTSTRAP_KEY: ['dev', 'change-me'],
  };
  for (const [k, devs] of Object.entries(dangerousDevDefaults)) {
    const v = process.env[k];
    if (v !== undefined && devs.includes(v)) {
      throw new Error(
        `Refusing to boot api-shore in production — ${k} is set to the dev default '${v}'`,
      );
    }
  }
}
