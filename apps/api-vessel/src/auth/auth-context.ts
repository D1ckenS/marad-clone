/**
 * Auth context attached to every authenticated request after `JwtAuthGuard`.
 * Mirrors the shore-side type so app code reads identically. `vesselId` is
 * null for tenant-wide roles, but on a vessel install the active user is
 * almost always vessel-bound — the null path mostly exists for shore tokens
 * that happen to reach the vessel.
 */
export interface AuthContext {
  // null for SUPER_ADMIN (no tenant assignment, matches shore §18)
  readonly tenantId: string | null;
  readonly vesselId: string | null;
  readonly userId: string;
  readonly role: string;
}
