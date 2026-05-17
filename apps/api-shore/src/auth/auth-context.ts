/**
 * Shape attached to every authenticated request after `JwtAuthGuard` runs.
 *
 * `vesselId` is null for tenant-wide roles (TENANT_ADMIN, PURCHASE_MANAGER)
 * who aren't bound to a single ship. Vessel-scoped endpoints must reject
 * those requests at the service layer.
 */
import { ForbiddenException } from '@nestjs/common';

export interface AuthContext {
  readonly tenantId: string | null; // null for SUPER_ADMIN (no company assignment)
  readonly vesselId: string | null;
  readonly userId: string;
  readonly role: string;
}

/**
 * Narrows auth.tenantId to string. Call at the top of any service method that
 * needs a tenantId — withTenant() will also throw at runtime if null, but this
 * helper lets TypeScript track the narrowing so Prisma query types check out.
 */
export function requireTenantId(auth: AuthContext): string {
  if (!auth.tenantId) throw new ForbiddenException('This endpoint requires a company account');
  return auth.tenantId;
}
