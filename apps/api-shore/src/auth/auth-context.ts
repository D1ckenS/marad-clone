/**
 * Shape attached to every authenticated request after `JwtAuthGuard` runs.
 *
 * `vesselId` is null for tenant-wide roles (TENANT_ADMIN, PURCHASE_MANAGER)
 * who aren't bound to a single ship. Vessel-scoped endpoints must reject
 * those requests at the service layer.
 */
export interface AuthContext {
  readonly tenantId: string;
  readonly vesselId: string | null;
  readonly userId: string;
  readonly role: string;
}
