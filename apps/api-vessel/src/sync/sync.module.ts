import { Global, Module } from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service';
import { DrizzleSyncAdapter } from './drizzle-sync-adapter';
import { SyncClientService } from './sync-client.service';

/**
 * Vessel-side sync module. Provides:
 *   - DrizzleSyncAdapter (singleton) for any future controller that
 *     needs to enqueue an outbox write.
 *   - SyncClientService that opens the gRPC stream to shore when
 *     SYNC_ENABLED=1 (no-op otherwise).
 */
@Global()
@Module({
  providers: [
    {
      provide: DrizzleSyncAdapter,
      useFactory: (drizzle: DrizzleService) => new DrizzleSyncAdapter(drizzle.db),
      inject: [DrizzleService],
    },
    SyncClientService,
  ],
  exports: [DrizzleSyncAdapter, SyncClientService],
})
export class SyncModule {}
