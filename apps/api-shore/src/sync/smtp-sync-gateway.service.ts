import {
  NodemailerImapProvider,
  SyncEngine,
  decodeBatch,
  encodeBatch,
  makeSubject,
  parseSubject,
  type MailEnvelope,
} from '@fleetops/sync-engine';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { HlcClockRegistry } from './hlc-clock-registry';
import { PRISMA_SYNC_ADAPTER_FACTORY, type PrismaSyncAdapterFactory } from './sync.tokens';

/**
 * Shore-side SMTP sync gateway (ADR 0002 §6).
 *
 * Activated when `SMTP_SYNC_ENABLED=1`. Polls a shared IMAP inbox for vessel
 * batch emails, routes each batch to the correct (tenant, vessel) SyncEngine,
 * and emails any pending shore→vessel deltas back using the vessel's `from`
 * address as the reply-to target.
 *
 * Required env vars when SMTP_SYNC_ENABLED=1:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE (0|1), SMTP_USER, SMTP_PASS
 *   IMAP_HOST, IMAP_PORT, IMAP_SECURE (0|1), IMAP_USER, IMAP_PASS
 *   SMTP_SYNC_FROM_ADDRESS  — the shore's sender identity
 *   SMTP_SYNC_POLL_INTERVAL_MS  — IMAP poll interval (default 300 000)
 */
@Injectable()
export class SmtpSyncGatewayService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(SmtpSyncGatewayService.name);
  private readonly engines = new Map<string, SyncEngine>();
  private provider: NodemailerImapProvider | null = null;

  constructor(
    @Inject(PRISMA_SYNC_ADAPTER_FACTORY)
    private readonly adapterFactory: PrismaSyncAdapterFactory,
    private readonly clocks: HlcClockRegistry,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env['SMTP_SYNC_ENABLED'] !== '1') {
      this.log.log('SMTP_SYNC_ENABLED!=1 — skipping SMTP sync gateway boot');
      return;
    }
    const smtpPort = Number(process.env['SMTP_PORT'] ?? '587');
    const imapPort = Number(process.env['IMAP_PORT'] ?? '993');
    const smtpSecure = process.env['SMTP_SECURE'] === '1';
    const imapSecure = process.env['IMAP_SECURE'] !== '0';
    const pollMs = Number(process.env['SMTP_SYNC_POLL_INTERVAL_MS'] ?? 300_000);

    this.provider = new NodemailerImapProvider({
      smtp: {
        host: process.env['SMTP_HOST'] ?? 'localhost',
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: process.env['SMTP_USER'] ?? '',
          pass: process.env['SMTP_PASS'] ?? '',
        },
      },
      imap: {
        host: process.env['IMAP_HOST'] ?? 'localhost',
        port: imapPort,
        secure: imapSecure,
        auth: {
          user: process.env['IMAP_USER'] ?? '',
          pass: process.env['IMAP_PASS'] ?? '',
        },
      },
      pollIntervalMs: pollMs,
    });

    await this.provider.startReceiving(async (envelope: MailEnvelope) => {
      await this.handleIncoming(envelope.subject, envelope.attachmentData, envelope.from);
    });

    this.log.log(`SMTP sync gateway polling every ${pollMs}ms`);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.provider === null) return;
    this.log.log('SMTP sync gateway shutting down');
    await this.provider.stopReceiving();
    this.provider = null;
  }

  private async handleIncoming(
    subject: string,
    attachmentData: Buffer,
    vesselFromAddress: string,
  ): Promise<void> {
    const meta = parseSubject(subject);
    if (meta === null) return;
    const { tenantId, vesselId, nodeId } = meta;

    let deltas;
    try {
      deltas = await decodeBatch(attachmentData);
    } catch {
      this.log.warn(`SMTP batch decode failed from ${vesselFromAddress} (corrupt attachment)`);
      return;
    }

    const engine = this.engineFor(tenantId, vesselId);
    let applied = 0;
    for (const d of deltas) {
      try {
        await engine.applyRemoteDelta(d);
        applied++;
      } catch (err) {
        this.log.warn(`applyRemoteDelta failed: ${(err as Error).message}`);
      }
    }
    this.log.log(
      `SMTP ← vessel tenant=${tenantId} vessel=${vesselId} node=${nodeId} applied=${applied}/${deltas.length}`,
    );

    await this.replyToVessel(engine, tenantId, vesselId, vesselFromAddress);
  }

  private async replyToVessel(
    engine: SyncEngine,
    tenantId: string,
    vesselId: string,
    vesselEmail: string,
  ): Promise<void> {
    if (this.provider === null) return;
    const pending = await engine.drainOutbox(500);
    if (pending.length === 0) return;

    const deltas = pending.map((e) => ({
      entityType: e.entityType,
      entityId: e.entityId,
      operation: e.operation,
      payload: e.payload,
      hlc: e.hlc,
      nodeId: e.nodeId,
    }));

    try {
      const attachmentData = await encodeBatch(deltas);
      const shoreNodeId = `${tenantId}-${vesselId}-shore`;
      const hlc = deltas[deltas.length - 1]!.hlc;
      const subject = makeSubject({ nodeId: shoreNodeId, tenantId, vesselId, hlc });
      const fromAddress =
        process.env['SMTP_SYNC_FROM_ADDRESS'] ?? process.env['SMTP_USER'] ?? 'sync@fleetops.io';
      await this.provider.send({
        from: fromAddress,
        to: vesselEmail,
        subject,
        attachmentData,
        attachmentName: `fleetops-sync-${shoreNodeId}-${hlc}.bin`,
      });
      this.log.log(`SMTP → vessel tenant=${tenantId} vessel=${vesselId} deltas=${deltas.length}`);
    } catch (err) {
      this.log.warn(`SMTP reply to vessel failed: ${(err as Error).message}`);
    }
  }

  private engineFor(tenantId: string, vesselId: string): SyncEngine {
    const key = `${tenantId}:${vesselId}`;
    let engine = this.engines.get(key);
    if (engine === undefined) {
      const adapter = this.adapterFactory(tenantId, vesselId);
      const { clock, nodeId } = this.clocks.entryFor(tenantId, vesselId);
      engine = new SyncEngine(adapter, clock, nodeId);
      this.engines.set(key, engine);
    }
    return engine;
  }

  /** Test accessor — number of active (tenant, vessel) engines. */
  engineCount(): number {
    return this.engines.size;
  }
}
