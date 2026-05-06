import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaSyncAdapter } from './prisma-sync-adapter';
import { SyncGatewayService } from './sync-gateway.service';
import { PRISMA_SYNC_ADAPTER_FACTORY, type PrismaSyncAdapterFactory } from './sync.tokens';

/**
 * Shore-side sync module. Exposes a factory for creating a
 * `PrismaSyncAdapter` scoped to a (tenantId, vesselId) pair on demand,
 * plus the SyncGatewayService that boots the gRPC server when
 * SYNC_ENABLED=1.
 *
 * The shore runs N adapters (one per active vessel session) per ADR
 * 0002 §9, so we cannot register a singleton adapter — instead we
 * publish the factory via PRISMA_SYNC_ADAPTER_FACTORY (re-exported from
 * ./sync.tokens to avoid circular imports with SyncGatewayService).
 */
export { PRISMA_SYNC_ADAPTER_FACTORY, type PrismaSyncAdapterFactory } from './sync.tokens';

@Global()
@Module({
  providers: [
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
  exports: [PRISMA_SYNC_ADAPTER_FACTORY, SyncGatewayService],
})
export class SyncModule {}
