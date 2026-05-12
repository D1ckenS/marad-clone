import { GrpcSyncTransport, SyncEngine, type SyncDelta } from '@marad-clone/sync-engine';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { resolve } from 'node:path';
import { DrizzleSyncAdapter } from './drizzle-sync-adapter';
import { HlcClockRegistry } from './hlc-clock-registry';

const PROTO_PATH_DEFAULT = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'proto',
  'sync.proto',
);

const RECONNECT_MAX_DELAY_MS = 60_000;
const RECONNECT_BASE_DELAY_MS = 1_000;

/**
 * Boots the vessel-side gRPC client when SYNC_ENABLED=1. Owns one
 * SyncEngine wired to DrizzleSyncAdapter. Implements the reconnect
 * strategy from ADR 0002 §5: exponential backoff (1s, 2s, 4s, ...)
 * capped at 60s, multiplied by random(0.5, 1.5) jitter.
 *
 * On a successful connection the service:
 *   1. Installs a receive callback that funnels deltas into engine.applyRemoteDelta
 *   2. Starts a periodic outbox drain (DRAIN_INTERVAL_MS) that pushes
 *      vessel-originated deltas upstream.
 *
 * On disconnect (or initial connect failure) it backs off and retries.
 *
 * Auth: SYNC_AUTH_TOKEN env var (any non-empty string in dev mode).
 */
@Injectable()
export class SyncClientService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(SyncClientService.name);
  private engine: SyncEngine | null = null;
  private transport: GrpcSyncTransport | null = null;
  private reconnectAttempt = 0;
  private drainTimer: NodeJS.Timeout | null = null;
  private stopping = false;

  constructor(
    private readonly adapter: DrizzleSyncAdapter,
    private readonly clocks: HlcClockRegistry,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env['SYNC_ENABLED'] !== '1') {
      this.log.log('SYNC_ENABLED!=1 — skipping gRPC sync client boot');
      return;
    }

    const tenantId = process.env['SYNC_TENANT_ID'];
    const vesselId = process.env['SYNC_VESSEL_ID'];
    if (tenantId === undefined || vesselId === undefined) {
      this.log.error('SYNC_TENANT_ID or SYNC_VESSEL_ID missing — sync disabled');
      return;
    }
    const { clock, nodeId } = this.clocks.entryFor(tenantId, vesselId);
    this.engine = new SyncEngine(this.adapter, clock, nodeId);

    void this.connectLoop({ tenantId, vesselId, nodeId });
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.drainTimer !== null) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
    if (this.transport !== null) {
      await this.transport.close().catch(() => undefined);
      this.transport = null;
    }
  }

  private async connectLoop(opts: {
    tenantId: string;
    vesselId: string;
    nodeId: string;
  }): Promise<void> {
    while (!this.stopping) {
      try {
        const transport = new GrpcSyncTransport({
          protoPath: process.env['SYNC_PROTO_PATH'] ?? PROTO_PATH_DEFAULT,
          serverAddress: process.env['SHORE_SYNC_URL'] ?? 'localhost:50051',
          hello: { tenantId: opts.tenantId, vesselId: opts.vesselId, nodeId: opts.nodeId },
          ...(process.env['SYNC_AUTH_TOKEN'] !== undefined && {
            authToken: process.env['SYNC_AUTH_TOKEN'],
          }),
        });
        await transport.start(async (d: SyncDelta) => {
          if (this.engine !== null) await this.engine.applyRemoteDelta(d);
        });
        this.transport = transport;
        this.reconnectAttempt = 0;
        this.log.log(`connected to ${process.env['SHORE_SYNC_URL'] ?? 'localhost:50051'}`);

        this.startDrainLoop();
        return; // wait for stopping or external disconnect
      } catch (err) {
        this.reconnectAttempt++;
        const delay = Math.min(
          RECONNECT_MAX_DELAY_MS,
          RECONNECT_BASE_DELAY_MS * 2 ** Math.min(this.reconnectAttempt - 1, 6),
        );
        const jittered = Math.floor(delay * (0.5 + Math.random()));
        this.log.warn(
          `connect failed (attempt ${this.reconnectAttempt}): ${(err as Error).message}; retrying in ${jittered}ms`,
        );
        await new Promise((r) => setTimeout(r, jittered));
      }
    }
  }

  private startDrainLoop(): void {
    const intervalMs = Number(process.env['SYNC_DRAIN_INTERVAL_MS'] ?? 5_000);
    this.drainTimer = setInterval(() => {
      void this.drainOnce();
    }, intervalMs);
  }

  private async drainOnce(): Promise<void> {
    if (this.engine === null || this.transport === null) return;
    try {
      const pending = await this.engine.drainOutbox(200);
      if (pending.length === 0) return;
      await this.transport.send(
        pending.map((e) => ({
          entityType: e.entityType,
          entityId: e.entityId,
          operation: e.operation,
          payload: e.payload,
          hlc: e.hlc,
          nodeId: e.nodeId,
        })),
      );
    } catch (err) {
      this.log.warn(`outbox drain failed: ${(err as Error).message}`);
    }
  }

  /** Test accessor — exposed for e2e verification, not for app code. */
  engineRef(): SyncEngine | null {
    return this.engine;
  }
}
