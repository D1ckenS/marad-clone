import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaSyncAdapter } from './prisma-sync-adapter';

/**
 * Shore-side sync module. Exposes a factory for creating a
 * `PrismaSyncAdapter` scoped to a (tenantId, vesselId) pair on demand.
 * The shore runs N adapters (one per active vessel session) per ADR
 * 0002 §9, so we cannot register a singleton — instead we publish the
 * factory and let the future SyncGatewayService instantiate adapters
 * per-stream.
 */
export type PrismaSyncAdapterFactory = (tenantId: string, vesselId: string) => PrismaSyncAdapter;

export const PRISMA_SYNC_ADAPTER_FACTORY = Symbol('PrismaSyncAdapterFactory');

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
  ],
  exports: [PRISMA_SYNC_ADAPTER_FACTORY],
})
export class SyncModule {}
