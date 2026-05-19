import type { MailEnvelope, MailProvider } from './smtp-transport.js';

/**
 * In-process mail provider for tests.
 *
 * `deliver()` pushes a received envelope into the registered callback,
 * simulating an incoming email from the remote peer without a real mail server.
 */
export class InMemoryMailProvider implements MailProvider {
  private readonly _sent: MailEnvelope[] = [];
  private _onEnvelope: ((e: MailEnvelope) => Promise<void>) | null = null;

  async send(envelope: MailEnvelope): Promise<void> {
    this._sent.push({ ...envelope });
  }

  async startReceiving(onEnvelope: (e: MailEnvelope) => Promise<void>): Promise<void> {
    this._onEnvelope = onEnvelope;
  }

  async stopReceiving(): Promise<void> {
    this._onEnvelope = null;
  }

  /** Simulate a message arriving from the remote peer. */
  async deliver(envelope: MailEnvelope): Promise<void> {
    if (this._onEnvelope !== null) await this._onEnvelope(envelope);
  }

  /** Snapshot of all envelopes sent through this provider. */
  sentMail(): readonly MailEnvelope[] {
    return [...this._sent];
  }
}
