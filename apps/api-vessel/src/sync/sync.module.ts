import { Global, Module } from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service';
import { DrizzleSyncAdapter } from './drizzle-sync-adapter';

/**
 * Vessel-side sync module. Provides the singleton DrizzleSyncAdapter that
 * any future controllers can inject to enqueue outbox writes or read
 * locally-applied sync state. The actual gRPC client transport is not
 * started by this module — see ADR 0002 §10 for the boot path. A follow-up
 * ticket will add a SyncClientService that opens the stream on app start.
 */
@Global()
@Module({
  providers: [
    {
      provide: DrizzleSyncAdapter,
      useFactory: (drizzle: DrizzleService) => new DrizzleSyncAdapter(drizzle.db),
      inject: [DrizzleService],
    },
  ],
  exports: [DrizzleSyncAdapter],
})
export class SyncModule {}
