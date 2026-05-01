/**
 * Common fields present on every sync-aware entity.
 * Per CLAUDE.md §7: id (ULID), hlc (Hybrid Logical Clock), updatedAt (UTC ISO 8601),
 * deletedAt (soft delete only on synced tables).
 */
export interface SyncMeta {
  readonly id: string;
  readonly hlc: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

/** Mixin for entities scoped to a tenant. */
export interface TenantScoped {
  readonly tenantId: string;
}

/** Mixin for entities scoped to a vessel; null for shared masters. */
export interface VesselScoped {
  readonly vesselId: string | null;
}
