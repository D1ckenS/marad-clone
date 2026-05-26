/**
 * Required-secret accessors that fail loudly at module init.
 *
 * Background (B2): both `jwt-auth.guard.ts` and `auth.service.ts` previously
 * defaulted to a hardcoded `'vessel-local-dev-secret-change-me'` if
 * `VESSEL_LOCAL_JWT_SECRET` was unset. Anyone with read access to the source
 * could mint a vessel-local token for any tenant/vessel/role. This module
 * makes that impossible: the API refuses to instantiate without a strong
 * secret.
 */

const DEV_DEFAULT = 'vessel-local-dev-secret-change-me';
const MIN_SECRET_LENGTH = 32;

export function requireVesselJwtSecret(): string {
  const s = process.env['VESSEL_LOCAL_JWT_SECRET'];
  if (s === undefined || s.trim() === '') {
    throw new Error(
      "VESSEL_LOCAL_JWT_SECRET is required. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  if (s === DEV_DEFAULT) {
    throw new Error(
      `VESSEL_LOCAL_JWT_SECRET must not be the dev default '${DEV_DEFAULT}' — regenerate per vessel`,
    );
  }
  if (s.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `VESSEL_LOCAL_JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${s.length})`,
    );
  }
  return s;
}
