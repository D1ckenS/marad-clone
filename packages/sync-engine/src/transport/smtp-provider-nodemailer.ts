import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { SMTP_SUBJECT_PREFIX, type MailEnvelope, type MailProvider } from './smtp-transport.js';

export interface NodemailerImapProviderOptions {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  };
  imap: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  };
  /** IMAP poll interval in ms. Default 300 000 (5 min). */
  pollIntervalMs?: number;
}

/**
 * Production `MailProvider` backed by nodemailer (SMTP send) and imapflow
 * (IMAP poll receive).
 *
 * Hardening notes:
 * - IMAP poll is per-connection (connect → fetch unseen → mark seen → logout)
 *   to tolerate satellite link instability; IDLE is not used.
 * - Each poll wraps individual message processing in try/catch so a single
 *   malformed message does not abort the entire poll.
 * - UIDs are marked `\Seen` in bulk after successful processing to minimise
 *   round-trips.
 * - SMTP and IMAP errors are surfaced as rejections; callers (SmtpSyncTransport
 *   and SmtpSyncGatewayService) silently swallow and retry on next timer tick.
 */
export class NodemailerImapProvider implements MailProvider {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private onEnvelope: ((e: MailEnvelope) => Promise<void>) | null = null;
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly opts: NodemailerImapProviderOptions) {
    this.transporter = nodemailer.createTransport({
      host: opts.smtp.host,
      port: opts.smtp.port,
      secure: opts.smtp.secure,
      auth: opts.smtp.auth,
    });
  }

  async send(envelope: MailEnvelope): Promise<void> {
    await this.transporter.sendMail({
      from: envelope.from,
      to: envelope.to,
      subject: envelope.subject,
      attachments: [{ filename: envelope.attachmentName, content: envelope.attachmentData }],
    });
  }

  async startReceiving(onEnvelope: (e: MailEnvelope) => Promise<void>): Promise<void> {
    this.onEnvelope = onEnvelope;
    const intervalMs = this.opts.pollIntervalMs ?? 300_000;
    this.pollTimer = setInterval(() => {
      void this.pollOnce().catch(() => undefined);
    }, intervalMs);
    await this.pollOnce().catch(() => undefined);
  }

  async stopReceiving(): Promise<void> {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.onEnvelope = null;
    this.transporter.close();
  }

  private async pollOnce(): Promise<void> {
    if (this.onEnvelope === null) return;
    const client = new ImapFlow({
      host: this.opts.imap.host,
      port: this.opts.imap.port,
      secure: this.opts.imap.secure,
      auth: this.opts.imap.auth,
      logger: false,
    });
    await client.connect();
    try {
      const lock = await client.getMailboxLock('INBOX');
      const processedUids: number[] = [];
      try {
        for await (const msg of client.fetch(
          { seen: false },
          { source: true, envelope: true },
          { uid: true },
        )) {
          const subject = msg.envelope?.subject ?? '';
          if (!subject.startsWith(SMTP_SUBJECT_PREFIX)) continue;
          try {
            const parsed = await simpleParser(msg.source as Buffer);
            const att = parsed.attachments.find((a) => a.filename?.endsWith('.bin'));
            if (att === undefined) continue;
            const from = String(parsed.from?.value[0]?.address ?? '');
            const toField = parsed.to;
            const to = Array.isArray(toField)
              ? String(toField[0]?.value[0]?.address ?? '')
              : String(toField?.value[0]?.address ?? '');
            await this.onEnvelope({
              from,
              to,
              subject: parsed.subject ?? subject,
              attachmentData: att.content,
              attachmentName: att.filename ?? 'sync.bin',
            });
            processedUids.push(msg.uid);
          } catch {
            // Skip malformed individual messages; next poll will re-attempt.
          }
        }
        if (processedUids.length > 0) {
          await client.messageFlagsAdd(processedUids.join(','), ['\\Seen'], { uid: true });
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }
}
