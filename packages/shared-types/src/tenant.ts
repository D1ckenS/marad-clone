import type { SyncMeta } from './sync.js';

/**
 * A customer organisation owning one or more vessels.
 * Tenants are not themselves tenant-scoped (they ARE the tenant boundary).
 */
export interface Tenant extends SyncMeta {
  readonly name: string;
}
