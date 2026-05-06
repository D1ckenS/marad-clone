import type { SyncDelta } from '../types.js';

/**
 * What the engine glue needs from a transport. Each side's outbox is
 * drained and fed into `send`; incoming deltas are surfaced via the
 * `receive` callback registered at construction.
 *
 * Implementations: GrpcSyncTransport (real bidi gRPC), SmtpSyncTransport
 * (P0-9 stub), and InProcessTransport (unit tests).
 */
export interface SyncTransport {
  /** Push a batch of locally-produced deltas toward the remote peer. */
  send(deltas: readonly SyncDelta[]): Promise<void>;

  /**
   * Open the transport and start delivering remote deltas to `onReceive`.
   * Resolves once the transport is ready to accept `send` calls.
   */
  start(onReceive: (delta: SyncDelta) => Promise<void>): Promise<void>;

  /** Close the transport. After close, `send` must reject. */
  close(): Promise<void>;
}
