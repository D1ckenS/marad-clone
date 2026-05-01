import type { SyncMeta, TenantScoped } from './sync.js';
import type { Role } from './role.js';

/** An authenticated user — crew aboard a vessel or shore-side personnel. */
export interface User extends SyncMeta, TenantScoped {
  readonly email: string;
  readonly displayName: string;
  readonly roles: readonly Role[];
}
