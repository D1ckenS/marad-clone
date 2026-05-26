/**
 * Production env guard for api-vessel (H2).
 *
 * Refuses to boot in production if any required secret is missing. Vessel
 * is more permissive than shore on S3 (some installs use the bundled
 * sidecar with embedded creds) but still requires the JWT material and
 * VESSEL_LOCAL_JWT_SECRET (already enforced separately by requireVesselJwtSecret).
 *
 * Called once from bootstrap() before NestFactory.create.
 */
export function assertProductionEnv(): void {
  if (process.env['NODE_ENV'] !== 'production') return;

  const required = ['DATABASE_URL', 'JWT_PUBLIC_KEY_PATH', 'VESSEL_LOCAL_JWT_SECRET'] as const;

  const missing = required.filter((k) => {
    const v = process.env[k];
    return v === undefined || v.trim() === '';
  });
  if (missing.length > 0) {
    throw new Error(
      `Refusing to boot api-vessel in production — missing required env: ${missing.join(', ')}`,
    );
  }

  // Known dev-default values that must never reach production.
  const dangerousDevDefaults: Record<string, string[]> = {
    VESSEL_LOCAL_JWT_SECRET: ['vessel-local-dev-secret-change-me'],
    VESSEL_BOOTSTRAP_KEY: ['dev', 'change-me'],
  };
  for (const [k, devs] of Object.entries(dangerousDevDefaults)) {
    const v = process.env[k];
    if (v !== undefined && devs.includes(v)) {
      throw new Error(
        `Refusing to boot api-vessel in production — ${k} is set to the dev default '${v}'`,
      );
    }
  }
}
