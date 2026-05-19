import {
  GrpcSyncTransport,
  NodemailerImapProvider,
  SmtpSyncTransport,
  SyncEngine,
  type SyncDelta,
  type SyncTransport,
} from '@fleetops/sync-engine';
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
  private transport: SyncTransport | null = null;
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

    if (process.env['SMTP_SYNC_ENABLED'] === '1') {
      await this.bootSmtp({ tenantId, vesselId, nodeId });
    } else {
      void this.connectLoop({ tenantId, vesselId, nodeId });
    }
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

  /**
   * Boot the SMTP fallback transport (ADR 0002 §6). Used when
   * `SMTP_SYNC_ENABLED=1`. The vessel periodically flushes its outbox as a
   * batch email; the shore's IMAP poll drives the exchange.
   *
   * Required env vars: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS,
   *   IMAP_HOST, IMAP_PORT, IMAP_SECURE, IMAP_USER, IMAP_PASS,
   *   SMTP_SYNC_FROM_ADDRESS, SMTP_SYNC_TO_ADDRESS (shore email),
   *   SMTP_SYNC_BATCH_INTERVAL_MS (default 3 600 000).
   */
  private async bootSmtp(opts: {
    tenantId: string;
    vesselId: string;
    nodeId: string;
  }): Promise<void> {
    const smtpPort = Number(process.env['SMTP_PORT'] ?? '587');
    const imapPort = Number(process.env['IMAP_PORT'] ?? '993');
    const smtpSecure = process.env['SMTP_SECURE'] === '1';
    const imapSecure = process.env['IMAP_SECURE'] !== '0';
    const batchIntervalMs = Number(process.env['SMTP_SYNC_BATCH_INTERVAL_MS'] ?? 3_600_000);
    const pollIntervalMs = Number(process.env['SMTP_SYNC_POLL_INTERVAL_MS'] ?? 300_000);

    const provider = new NodemailerImapProvider({
      smtp: {
        host: process.env['SMTP_HOST'] ?? 'localhost',
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: process.env['SMTP_USER'] ?? '', pass: process.env['SMTP_PASS'] ?? '' },
      },
      imap: {
        host: process.env['IMAP_HOST'] ?? 'localhost',
        port: imapPort,
        secure: imapSecure,
        auth: { user: process.env['IMAP_USER'] ?? '', pass: process.env['IMAP_PASS'] ?? '' },
      },
      pollIntervalMs,
    });

    const transport = new SmtpSyncTransport(
      {
        nodeId: opts.nodeId,
        tenantId: opts.tenantId,
        vesselId: opts.vesselId,
        fromAddress:
          process.env['SMTP_SYNC_FROM_ADDRESS'] ?? process.env['SMTP_USER'] ?? 'vessel@fleetops.io',
        toAddress: process.env['SMTP_SYNC_TO_ADDRESS'] ?? 'shore@fleetops.io',
        batchIntervalMs,
      },
      provider,
    );

    await transport.start(async (d: SyncDelta) => {
      if (this.engine !== null) await this.engine.applyRemoteDelta(d);
    });
    this.transport = transport;
    this.log.log(
      `SMTP sync transport active — batch every ${batchIntervalMs}ms, IMAP poll every ${pollIntervalMs}ms`,
    );
    this.startDrainLoop();
  }

  /** Test accessor — exposed for e2e verification, not for app code. */
  engineRef(): SyncEngine | null {
    return this.engine;
  }
}
