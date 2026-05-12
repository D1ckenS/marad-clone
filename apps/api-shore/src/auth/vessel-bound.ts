import { ForbiddenException } from '@nestjs/common';
import type { AuthContext } from './auth-context';

/**
 * Returns the vesselId from `auth`, throwing 403 if the JWT isn't bound
 * to a vessel. Use at the top of a vessel-scoped service method to
 * reject tenant-wide roles (TENANT_ADMIN, PURCHASE_MANAGER) cleanly.
 */
export function requireVesselId(auth: AuthContext): string {
  if (auth.vesselId === null) {
    throw new ForbiddenException('This endpoint requires a vessel-bound user');
  }
  return auth.vesselId;
}
