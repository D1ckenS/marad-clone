import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Tenant-agnostic mail sender for transactional email (H10 cert-expiry
 * alerts; future use for password-reset, etc.). Reads SMTP_* env vars at
 * boot; when any required field is missing the service degrades to a
 * **log-only transport** that writes envelopes to the pino logger.
 *
 * Log-only mode is the test + local-dev default — no SMTP setup needed
 * to run the app. Production must set all five vars or the audit
 * trail will show silent drops.
 *
 *   SMTP_HOST   (required to enable real send)
 *   SMTP_PORT   (default 587)
 *   SMTP_SECURE (default 'false' for STARTTLS on 587; set '1' for 465 implicit TLS)
 *   SMTP_USER   (required for auth)
 *   SMTP_PASS   (required for auth)
 *   SMTP_FROM   (required — sender address; falls back to `no-reply@<SMTP_HOST>`)
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly log = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor() {
    const host = process.env['SMTP_HOST'];
    const user = process.env['SMTP_USER'];
    const pass = process.env['SMTP_PASS'];
    const fromEnv = process.env['SMTP_FROM'];

    if (!host || !user || !pass) {
      this.enabled = false;
      this.transporter = null;
      this.from = fromEnv ?? 'no-reply@fleetops.local';
      this.log.warn(
        'SMTP_HOST / SMTP_USER / SMTP_PASS not all set — mail sender is in LOG-ONLY mode. ' +
          'Set the three plus SMTP_FROM to send real email.',
      );
      return;
    }

    const port = Number(process.env['SMTP_PORT'] ?? 587);
    const secure = process.env['SMTP_SECURE'] === '1' || port === 465;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    this.from = fromEnv ?? `no-reply@${host}`;
    this.enabled = true;
    this.log.log(`SMTP configured: host=${host} port=${port} secure=${secure} from=${this.from}`);
  }

  async send(msg: MailMessage): Promise<void> {
    const to = Array.isArray(msg.to) ? msg.to : [msg.to];
    if (to.length === 0) {
      this.log.warn(`send() called with empty recipient list — subject="${msg.subject}"`);
      return;
    }
    if (!this.enabled || this.transporter === null) {
      // Log-only path — same shape the audit trail can grep for.
      this.log.log(
        { kind: 'mail', mode: 'log-only', from: this.from, to, subject: msg.subject },
        `mail (log-only): to=${to.join(',')} subject="${msg.subject}"`,
      );
      if (msg.text) this.log.debug({ kind: 'mail', body: 'text' }, msg.text);
      if (msg.html) this.log.debug({ kind: 'mail', body: 'html' }, msg.html);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: msg.subject,
        ...(msg.text !== undefined && { text: msg.text }),
        ...(msg.html !== undefined && { html: msg.html }),
      });
      this.log.log(
        { kind: 'mail', mode: 'sent', from: this.from, to, subject: msg.subject },
        `mail sent: to=${to.join(',')} subject="${msg.subject}"`,
      );
    } catch (err) {
      // Don't throw — caller is typically running inside a cron / background
      // tick where a failed send shouldn't abort the rest of the batch.
      // The audit + logs make the failure visible.
      this.log.error(
        { kind: 'mail', mode: 'failed', from: this.from, to, subject: msg.subject },
        `mail send failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** True when real SMTP is wired (env vars set). Useful for tests. */
  isEnabled(): boolean {
    return this.enabled;
  }

  onModuleDestroy(): void {
    if (this.transporter !== null) this.transporter.close();
  }
}
