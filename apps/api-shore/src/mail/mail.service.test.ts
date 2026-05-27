import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MailService } from './mail.service';

const ENV_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

describe('MailService (H10)', () => {
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) snapshot[k] = process.env[k];
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(snapshot)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('runs in log-only mode when SMTP env vars are unset', () => {
    const svc = new MailService();
    expect(svc.isEnabled()).toBe(false);
  });

  it('runs in log-only mode when only some SMTP vars are set', () => {
    process.env['SMTP_HOST'] = 'smtp.example.com';
    // SMTP_USER + SMTP_PASS missing → still falls back to log-only
    const svc = new MailService();
    expect(svc.isEnabled()).toBe(false);
  });

  it('enables real SMTP when host, user, pass are all set', () => {
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'mailer@example.com';
    process.env['SMTP_PASS'] = 'secret';
    process.env['SMTP_FROM'] = 'alerts@example.com';
    const svc = new MailService();
    expect(svc.isEnabled()).toBe(true);
  });

  it('log-only send() does not throw even with an empty recipient list', async () => {
    const svc = new MailService();
    await expect(svc.send({ to: [], subject: 'noop', text: 'nobody' })).resolves.toBeUndefined();
  });

  it('log-only send() resolves for a real recipient (no network call)', async () => {
    const svc = new MailService();
    await expect(
      svc.send({ to: 'a@b.test', subject: 's', text: 't', html: '<p>h</p>' }),
    ).resolves.toBeUndefined();
  });
});
