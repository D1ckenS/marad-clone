import { promisify } from 'node:util';
import { gzip, gunzip } from 'node:zlib';
import type { SyncDelta } from '../types.js';
import type { SyncTransport } from './transport.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/** A single gzip-compressed sync batch ready to be transmitted as a mail attachment. */
export interface MailEnvelope {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  /** Gzip-compressed JSON-serialised `SyncDelta[]`. */
  readonly attachmentData: Buffer;
  readonly attachmentName: string;
}

/**
 * Mail-transport abstraction injected into `SmtpSyncTransport`.
 * Production code injects `NodemailerImapProvider`; tests inject
 * `InMemoryMailProvider`.
 */
export interface MailProvider {
  send(envelope: MailEnvelope): Promise<void>;
  /**
   * Begin watching for incoming sync envelopes. `onEnvelope` fires for each
   * message whose subject begins with `SMTP_SUBJECT_PREFIX`. Resolves once
   * the receive channel is ready.
   */
  startReceiving(onEnvelope: (envelope: MailEnvelope) => Promise<void>): Promise<void>;
  stopReceiving(): Promise<void>;
}

export interface SmtpTransportOptions {
  /** Stable identifier for this node's sync role. */
  readonly nodeId: string;
  readonly tenantId: string;
  readonly vesselId: string;
  readonly fromAddress: string;
  readonly toAddress: string;
  /** Batch flush interval in ms. Default 3 600 000 (1 hour, per ADR 0002 §6). */
  readonly batchIntervalMs?: number;
  /** Maximum deltas per email. Overflow spills into additional emails. Default 500. */
  readonly maxBatchSize?: number;
}

export const SMTP_SUBJECT_PREFIX = 'FleetOps-Sync';
const DEFAULT_BATCH_INTERVAL_MS = 3_600_000;
const DEFAULT_MAX_BATCH = 500;

interface SubjectFields {
  nodeId: string;
  tenantId: string;
  vesselId: string;
  hlc: string;
}

export function makeSubject(f: SubjectFields): string {
  return `${SMTP_SUBJECT_PREFIX}|node=${f.nodeId}|tenant=${f.tenantId}|vessel=${f.vesselId}|hlc=${f.hlc}`;
}

export function parseSubject(subject: string): SubjectFields | null {
  if (!subject.startsWith(SMTP_SUBJECT_PREFIX + '|')) return null;
  const parts = Object.fromEntries(
    subject
      .slice(SMTP_SUBJECT_PREFIX.length + 1)
      .split('|')
      .map((p) => {
        const eq = p.indexOf('=');
        return [p.slice(0, eq), p.slice(eq + 1)] as [string, string];
      }),
  );
  const { node: nodeId, tenant: tenantId, vessel: vesselId, hlc } = parts;
  if (!nodeId || !tenantId || !vesselId || !hlc) return null;
  return { nodeId, tenantId, vesselId, hlc };
}

/** Gzip-compress a batch of deltas for attachment. */
export async function encodeBatch(deltas: readonly SyncDelta[]): Promise<Buffer> {
  return gzipAsync(Buffer.from(JSON.stringify(deltas)));
}

/** Decompress and deserialise an attachment produced by `encodeBatch`. */
export async function decodeBatch(data: Buffer): Promise<SyncDelta[]> {
  const raw = await gunzipAsync(data);
  return JSON.parse(raw.toString('utf-8')) as SyncDelta[];
}

/**
 * SMTP fallback transport (ADR 0002 §6).
 *
 * Queues outgoing deltas and flushes them as gzip-compressed MIME attachments
 * on a periodic schedule (default 1 hour). Incoming batches arrive via the
 * `MailProvider`'s receive channel (e.g. an IMAP poll loop).
 *
 * Routing metadata (nodeId / tenantId / vesselId) is embedded in the email
 * subject so the shore gateway can fan-out to the correct `SyncEngine`.
 *
 * Hardening notes:
 * - Corrupted attachments (bad gzip / invalid JSON) are skipped silently;
 *   the SyncEngine's LWW merge handles duplicate delivery idempotently.
 * - Batches larger than `maxBatchSize` are chunked into multiple emails.
 * - On `close()` a best-effort final flush drains any queued deltas.
 * - gzip compression reduces satellite bandwidth (typically 60–80% reduction
 *   on repetitive JSON payloads).
 */
export class SmtpSyncTransport implements SyncTransport {
  private readonly queue: SyncDelta[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private onReceive: ((delta: SyncDelta) => Promise<void>) | null = null;
  private closed = false;

  constructor(
    private readonly opts: SmtpTransportOptions,
    private readonly provider: MailProvider,
  ) {}

  async start(onReceive: (delta: SyncDelta) => Promise<void>): Promise<void> {
    this.onReceive = onReceive;
    await this.provider.startReceiving(async (envelope) => {
      if (parseSubject(envelope.subject) === null) return;
      let deltas: SyncDelta[];
      try {
        deltas = await decodeBatch(envelope.attachmentData);
      } catch {
        return; // corrupted attachment — skip; idempotency handles retries
      }
      for (const d of deltas) {
        await this.onReceive!(d);
      }
    });
    const intervalMs = this.opts.batchIntervalMs ?? DEFAULT_BATCH_INTERVAL_MS;
    this.flushTimer = setInterval(() => {
      void this.flush().catch(() => undefined);
    }, intervalMs);
  }

  async send(deltas: readonly SyncDelta[]): Promise<void> {
    if (this.closed) throw new Error('SmtpSyncTransport is closed');
    this.queue.push(...deltas);
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.queue.length > 0) await this.flush().catch(() => undefined);
    await this.provider.stopReceiving();
  }

  /** Drain the pending queue immediately, emitting one email per chunk. */
  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const maxBatch = this.opts.maxBatchSize ?? DEFAULT_MAX_BATCH;
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, maxBatch);
      const hlc = batch[batch.length - 1]!.hlc;
      const subject = makeSubject({
        nodeId: this.opts.nodeId,
        tenantId: this.opts.tenantId,
        vesselId: this.opts.vesselId,
        hlc,
      });
      const attachmentData = await encodeBatch(batch);
      await this.provider.send({
        from: this.opts.fromAddress,
        to: this.opts.toAddress,
        subject,
        attachmentData,
        attachmentName: `fleetops-sync-${this.opts.nodeId}-${hlc}.bin`,
      });
    }
  }
}
