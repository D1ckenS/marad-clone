import { HlcClock } from '@marad-clone/domain';
import { SyncEngine, startSyncServer, type SyncDelta } from '@marad-clone/sync-engine';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { resolve } from 'node:path';
import { PRISMA_SYNC_ADAPTER_FACTORY, type PrismaSyncAdapterFactory } from './sync.tokens';

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

/**
 * Boots the gRPC sync server on application start when SYNC_ENABLED=1.
 *
 * Per ADR 0002 §9 the shore runs one SyncEngine per (tenant, vessel) pair.
 * On stream open we look up `(tenantId, vesselId)` from the Hello and lazily
 * create the engine for that pair using the PrismaSyncAdapterFactory.
 *
 * Auth (JWT validation, tenant/vessel match enforcement) is dev-mode only
 * for P0-9 — any non-empty Authorization metadata is accepted. P0-10 will
 * tighten this.
 */
@Injectable()
export class SyncGatewayService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(SyncGatewayService.name);
  private readonly engines = new Map<string, SyncEngine>();
  private shutdownFn: (() => Promise<void>) | null = null;

  constructor(
    @Inject(PRISMA_SYNC_ADAPTER_FACTORY)
    private readonly adapterFactory: PrismaSyncAdapterFactory,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env['SYNC_ENABLED'] !== '1') {
      this.log.log('SYNC_ENABLED!=1 — skipping gRPC sync server boot');
      return;
    }
    const port = process.env['SYNC_GRPC_PORT'] ?? '50051';
    const protoPath = process.env['SYNC_PROTO_PATH'] ?? PROTO_PATH_DEFAULT;

    const { port: bound, shutdown } = await startSyncServer(`0.0.0.0:${port}`, {
      protoPath,
      onStreamOpen: async (hello, send) => {
        const key = `${hello.tenantId}:${hello.vesselId}`;
        let engine = this.engines.get(key);
        if (engine === undefined) {
          const adapter = this.adapterFactory(hello.tenantId, hello.vesselId);
          const nodeId = `${hello.tenantId}-shore`;
          const clock = new HlcClock({ nodeId, now: () => Date.now() });
          engine = new SyncEngine(adapter, clock, nodeId);
          this.engines.set(key, engine);
        }

        // Drain anything already queued in the shore outbox for this vessel.
        const pending = await engine.drainOutbox(500);
        for (const e of pending) {
          await send({
            entityType: e.entityType,
            entityId: e.entityId,
            operation: e.operation,
            payload: e.payload,
            hlc: e.hlc,
            nodeId: e.nodeId,
          });
        }

        this.log.log(
          `stream open tenant=${hello.tenantId} vessel=${hello.vesselId} nodeId=${hello.nodeId}`,
        );

        return {
          welcome: { cursors: {}, sessionId: `${key}-${Date.now()}` },
          onReceive: async (d: SyncDelta) => {
            await engine!.applyRemoteDelta(d);
          },
          onClose: async () => {
            this.log.log(`stream close tenant=${hello.tenantId} vessel=${hello.vesselId}`);
          },
        };
      },
    });

    this.shutdownFn = shutdown;
    this.log.log(`gRPC sync server listening on 0.0.0.0:${bound}`);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.shutdownFn === null) return;
    this.log.log('shutting down gRPC sync server');
    await this.shutdownFn();
    this.shutdownFn = null;
  }

  /** Test/diag accessor — engines created so far. */
  engineCount(): number {
    return this.engines.size;
  }

  /** Test/diag accessor — engine for a given pair, or null. */
  engineFor(tenantId: string, vesselId: string): SyncEngine | null {
    return this.engines.get(`${tenantId}:${vesselId}`) ?? null;
  }
}
