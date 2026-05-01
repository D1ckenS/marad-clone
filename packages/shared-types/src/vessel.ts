import type { SyncMeta, TenantScoped } from './sync.js';

/** A ship/vessel owned by a tenant. */
export interface Vessel extends SyncMeta, TenantScoped {
  readonly name: string;
  /** IMO number — 7 digits, globally unique across vessel's lifetime. */
  readonly imo: string | null;
  /** Maritime Mobile Service Identity — 9 digits, used for AIS/VHF. */
  readonly mmsi: string | null;
  /** Flag state, ISO 3166-1 alpha-2 (e.g. "PA", "MH", "SG"). */
  readonly flag: string | null;
}
