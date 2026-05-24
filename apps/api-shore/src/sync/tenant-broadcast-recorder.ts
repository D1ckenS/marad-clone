import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { OutboxRecorder } from './outbox-recorder';

/**
 * Shore-side broadcast helper for tenant-scoped entities (catalogs that
 * have no `vessel_id` column — e.g. MasterComponent, PartCategory,
 * Supplier, Jha, QhseObjective, DrybmsElement, ManagementReview).
 *
 * A tenant write on shore needs to land on every vessel of that tenant.
 * This recorder fans the write out by calling `OutboxRecorder` once per
 * vessel — same outbox table, same per-(tenant,vessel) sync_records
 * row — so all existing drain / LWW / cursor logic works unchanged.
 *
 * Storage cost: O(vessels-per-tenant) rows per write. With typical pilot
 * fleets of 1–10 vessels this is fine; if it ever isn't, swap to a
 * vesselId=NULL "broadcast" row + drain-time fanout (no API change).
 *
 * Pass the same `tx` you used for the entity write so the outbox
 * fan-out commits or rolls back atomically.
 */
@Injectable()
export class TenantBroadcastRecorder {
  constructor(private readonly outbox: OutboxRecorder) {}

  async broadcastUpsert(
    tx: Prisma.TransactionClient,
    tenantId: string,
    entityType: string,
    entityId: string,
    fields: Record<string, unknown>,
  ): Promise<{ vesselCount: number }> {
    const vessels = await tx.vessel.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    for (const v of vessels) {
      await this.outbox.recordUpsert(
        tx,
        { tenantId, vesselId: v.id },
        entityType,
        entityId,
        fields,
      );
    }
    return { vesselCount: vessels.length };
  }

  async broadcastDelete(
    tx: Prisma.TransactionClient,
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<{ vesselCount: number }> {
    const vessels = await tx.vessel.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    for (const v of vessels) {
      await this.outbox.recordDelete(tx, { tenantId, vesselId: v.id }, entityType, entityId);
    }
    return { vesselCount: vessels.length };
  }
}
