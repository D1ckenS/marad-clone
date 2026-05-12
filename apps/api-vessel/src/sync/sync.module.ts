import { Global, Module } from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service';
import { DrizzleSyncAdapter } from './drizzle-sync-adapter';
import { HlcClockRegistry } from './hlc-clock-registry';
import { OutboxRecorder } from './outbox-recorder';
import { SyncClientService } from './sync-client.service';

/**
 * Vessel-side sync module. Provides:
 *   - `DrizzleSyncAdapter` (singleton) for the gRPC client to enqueue / pick
 *     up outbox rows.
 *   - `HlcClockRegistry` (singleton) shared between `OutboxRecorder` and
 *     `SyncClientService` so HLC monotonicity holds across app writes and
 *     stream-side handling.
 *   - `OutboxRecorder` — tx-aware writer used by entity services.
 *   - `SyncClientService` — opens the gRPC stream to shore when
 *     SYNC_ENABLED=1 (no-op otherwise).
 */
@Global()
@Module({
  providers: [
    HlcClockRegistry,
    OutboxRecorder,
    {
      provide: DrizzleSyncAdapter,
      useFactory: (drizzle: DrizzleService) => new DrizzleSyncAdapter(drizzle.db),
      inject: [DrizzleService],
    },
    SyncClientService,
  ],
  exports: [DrizzleSyncAdapter, HlcClockRegistry, OutboxRecorder, SyncClientService],
})
export class SyncModule {}
