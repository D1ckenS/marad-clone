import type { SyncDelta } from '../types.js';
import type { SyncTransport } from './transport.js';

/**
 * SMTP fallback transport — interface stub only (P0-9 §6 of ADR 0002).
 *
 * In production this would batch outgoing deltas, base64-encode them as a
 * MIME attachment, and dispatch via SMTP; the receiver's IMAP poller
 * would unpack and feed into the same `applyRemoteDelta` path. For P0-9
 * the body is intentionally a no-op so the wire-protocol contract is
 * locked in without committing to satellite-mail integration.
 */
export interface SmtpTransportOptions {
  /** Hostname of the outbound SMTP relay. */
  smtpHost: string;
  /** Inbox the receiver polls for incoming sync envelopes. */
  imapHost: string;
  /** Sender identity (must be authorised on the SMTP relay). */
  fromAddress: string;
  /** Receiver address. */
  toAddress: string;
  /** Batching interval (default 1 hour per ADR 0002 §6). */
  batchIntervalMs?: number;
}

export class SmtpSyncTransport implements SyncTransport {
  private onReceive: ((delta: SyncDelta) => Promise<void>) | null = null;
  private closed = false;

  constructor(private readonly opts: SmtpTransportOptions) {}

  async start(onReceive: (delta: SyncDelta) => Promise<void>): Promise<void> {
    this.onReceive = onReceive;
    // Real implementation: open IMAP IDLE connection, parse MIME envelopes,
    // base64-decode, JSON-parse the embedded DeltaBatch, call onReceive.
  }

  async send(deltas: readonly SyncDelta[]): Promise<void> {
    if (this.closed) throw new Error('transport closed');
    if (deltas.length === 0) return;
    // Real implementation: append to a per-batch queue, flush every
    // `batchIntervalMs` as a single MIME-attached message via SMTP.
    void this.opts;
    void this.onReceive;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}
