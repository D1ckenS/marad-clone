import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HlcClockRegistry } from './hlc-clock-registry';
import { OutboxRecorder } from './outbox-recorder';
import { PrismaSyncAdapter } from './prisma-sync-adapter';
import { SyncGatewayService } from './sync-gateway.service';
import { PRISMA_SYNC_ADAPTER_FACTORY, type PrismaSyncAdapterFactory } from './sync.tokens';

/**
 * Shore-side sync module. Exposes:
 *   - `PRISMA_SYNC_ADAPTER_FACTORY` — creates a `PrismaSyncAdapter` scoped
 *     to a (tenantId, vesselId) pair on demand. The shore runs N adapters
 *     (one per active vessel session) per ADR 0002 §9.
 *   - `HlcClockRegistry` — singleton, owns one HLC clock per (tenant,
 *     vessel) pair shared across `OutboxRecorder` and `SyncGatewayService`.
 *   - `OutboxRecorder` — tx-aware writer used by entity services to bridge
 *     domain writes to the outbox + sync_records.
 *   - `SyncGatewayService` — boots the gRPC server when SYNC_ENABLED=1.
 */
export { PRISMA_SYNC_ADAPTER_FACTORY, type PrismaSyncAdapterFactory } from './sync.tokens';

@Global()
@Module({
  providers: [
    HlcClockRegistry,
    OutboxRecorder,
    {
      provide: PRISMA_SYNC_ADAPTER_FACTORY,
      useFactory:
        (prisma: PrismaService): PrismaSyncAdapterFactory =>
        (tenantId, vesselId) =>
          new PrismaSyncAdapter(prisma, tenantId, vesselId),
      inject: [PrismaService],
    },
    SyncGatewayService,
  ],
  exports: [PRISMA_SYNC_ADAPTER_FACTORY, HlcClockRegistry, OutboxRecorder, SyncGatewayService],
})
export class SyncModule {}
