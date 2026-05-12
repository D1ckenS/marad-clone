import { Injectable } from '@nestjs/common';
import { HlcClock } from '@fleetops/domain';

/**
 * Per-(tenantId, vesselId) HLC clock registry. On the vessel side typically
 * only one pair is active at a time (SYNC_TENANT_ID + SYNC_VESSEL_ID), but
 * keeping it keyed mirrors the shore API and future-proofs multi-tenant
 * vessel installs. Shared between `OutboxRecorder` (app writes) and
 * `SyncClientService` (stream-side handling) so HLC monotonicity holds
 * across both code paths.
 */
@Injectable()
export class HlcClockRegistry {
  private readonly entries = new Map<string, { clock: HlcClock; nodeId: string }>();

  entryFor(tenantId: string, vesselId: string): { clock: HlcClock; nodeId: string } {
    const key = `${tenantId}:${vesselId}`;
    let entry = this.entries.get(key);
    if (entry === undefined) {
      const nodeId = `${vesselId}-vessel`;
      entry = { clock: new HlcClock({ nodeId }), nodeId };
      this.entries.set(key, entry);
    }
    return entry;
  }

  clockFor(tenantId: string, vesselId: string): HlcClock {
    return this.entryFor(tenantId, vesselId).clock;
  }

  nodeIdFor(tenantId: string, vesselId: string): string {
    return this.entryFor(tenantId, vesselId).nodeId;
  }

  /** Test-only — wipes the registry. */
  reset(): void {
    this.entries.clear();
  }
}
