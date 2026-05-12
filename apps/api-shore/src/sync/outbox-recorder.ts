import { Injectable } from '@nestjs/common';
import { encodeHlc, newId } from '@fleetops/domain';
import { mergeFields, type LwwRecord } from '@fleetops/sync-engine';
import { Prisma } from '@prisma/client';
import { HlcClockRegistry } from './hlc-clock-registry';

/**
 * Tx-aware writer that bridges domain writes to the sync wire.
 *
 * Each `recordUpsert` / `recordDelete` call:
 *   1. Mints a fresh HLC from the (tenantId, vesselId) clock.
 *   2. Appends an `outbox` row inside the caller's Prisma transaction so the
 *      gateway can pick it up on the next stream.
 *   3. Materialises the local `sync_records` row (with per-field LWW merge
 *      against any prior value) so future incoming remote deltas know the
 *      last-seen HLC for every field. Skipping this step would let a remote
 *      delta on an untouched field overwrite the local entity-table value.
 *
 * The caller is responsible for the entity-table write — pass in `tx` so
 * the entity row, the outbox row, and the sync_records merge all commit or
 * roll back together. The returned `hlc` is the encoded string the caller
 * stamps onto the entity row's `hlc` column.
 */
@Injectable()
export class OutboxRecorder {
  constructor(private readonly clocks: HlcClockRegistry) {}

  async recordUpsert(
    tx: Prisma.TransactionClient,
    ctx: { tenantId: string; vesselId: string },
    entityType: string,
    entityId: string,
    fields: Record<string, unknown>,
  ): Promise<{ hlc: string; nodeId: string }> {
    const { clock, nodeId } = this.clocks.entryFor(ctx.tenantId, ctx.vesselId);
    const hlcStr = encodeHlc(clock.send());

    const incoming: LwwRecord = {};
    for (const [k, v] of Object.entries(fields)) {
      incoming[k] = { value: v, hlc: hlcStr };
    }

    await tx.outbox.create({
      data: {
        id: newId(),
        tenantId: ctx.tenantId,
        vesselId: ctx.vesselId,
        entityType,
        entityId,
        operation: 'upsert',
        payload: incoming as unknown as Prisma.InputJsonValue,
        hlc: hlcStr,
        nodeId,
      },
    });

    await this.mergeIntoSyncRecord(tx, ctx, entityType, entityId, hlcStr, incoming, false);

    return { hlc: hlcStr, nodeId };
  }

  async recordDelete(
    tx: Prisma.TransactionClient,
    ctx: { tenantId: string; vesselId: string },
    entityType: string,
    entityId: string,
  ): Promise<{ hlc: string; nodeId: string }> {
    const { clock, nodeId } = this.clocks.entryFor(ctx.tenantId, ctx.vesselId);
    const hlcStr = encodeHlc(clock.send());

    await tx.outbox.create({
      data: {
        id: newId(),
        tenantId: ctx.tenantId,
        vesselId: ctx.vesselId,
        entityType,
        entityId,
        operation: 'delete',
        payload: Prisma.JsonNull,
        hlc: hlcStr,
        nodeId,
      },
    });

    await this.mergeIntoSyncRecord(tx, ctx, entityType, entityId, hlcStr, {}, true);

    return { hlc: hlcStr, nodeId };
  }

  private async mergeIntoSyncRecord(
    tx: Prisma.TransactionClient,
    ctx: { tenantId: string; vesselId: string },
    entityType: string,
    entityId: string,
    hlcStr: string,
    incoming: LwwRecord,
    deleted: boolean,
  ): Promise<void> {
    const where = {
      tenantId_vesselId_entityType_entityId: {
        tenantId: ctx.tenantId,
        vesselId: ctx.vesselId,
        entityType,
        entityId,
      },
    };
    const existing = await tx.syncRecord.findUnique({ where });
    const baseFields =
      existing === null ? ({} as LwwRecord) : (existing.fields as unknown as LwwRecord);
    const { record: mergedFields } = mergeFields(baseFields, incoming);

    const deletedAt = deleted ? new Date() : null;

    await tx.syncRecord.upsert({
      where,
      create: {
        tenantId: ctx.tenantId,
        vesselId: ctx.vesselId,
        entityType,
        entityId,
        hlc: hlcStr,
        deletedAt,
        fields: mergedFields as unknown as Prisma.InputJsonValue,
      },
      update: {
        hlc: hlcStr,
        deletedAt,
        fields: mergedFields as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
