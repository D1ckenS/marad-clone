import { Injectable } from '@nestjs/common';
import { HlcClock } from '@fleetops/domain';

/**
 * Per-(tenantId, vesselId) HLC clock registry. One singleton, one clock per
 * pair, reused across the whole shore process so that app writes
 * (OutboxRecorder) and stream-side handling (SyncGatewayService) share the
 * same monotonic state. If they used separate clocks, they could mint
 * conflicting HLCs (same ms + counter, different node) for events that
 * actually have a happens-before relationship.
 */
@Injectable()
export class HlcClockRegistry {
  private readonly entries = new Map<string, { clock: HlcClock; nodeId: string }>();

  entryFor(tenantId: string, vesselId: string): { clock: HlcClock; nodeId: string } {
    const key = `${tenantId}:${vesselId}`;
    let entry = this.entries.get(key);
    if (entry === undefined) {
      const nodeId = `${tenantId}-shore`;
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
