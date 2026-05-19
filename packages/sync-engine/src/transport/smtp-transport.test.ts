import { describe, expect, it } from 'vitest';
import type { SyncDelta } from '../types.js';
import { InMemoryMailProvider } from './smtp-provider-memory.js';
import {
  SMTP_SUBJECT_PREFIX,
  SmtpSyncTransport,
  decodeBatch,
  encodeBatch,
  makeSubject,
  parseSubject,
} from './smtp-transport.js';

const BASE_OPTS = {
  nodeId: 'node-vessel-01',
  tenantId: 'tenant-abc',
  vesselId: 'vessel-xyz',
  fromAddress: 'vessel@example.com',
  toAddress: 'shore@example.com',
  batchIntervalMs: 999_999_999, // never auto-flush in tests
  maxBatchSize: 500,
} as const;

const delta = (id: string, hlc = '2026-01-01T00:00:00.000Z-0-node'): SyncDelta => ({
  entityType: 'part',
  entityId: id,
  operation: 'upsert' as const,
  payload: { name: { value: `Part ${id}`, hlc } },
  hlc,
  nodeId: 'node-vessel-01',
});

// ── codec ────────────────────────────────────────────────────────────────────

describe('encodeBatch / decodeBatch', () => {
  it('roundtrips deltas through gzip', async () => {
    const deltas = [delta('a'), delta('b')];
    const buf = await encodeBatch(deltas);
    expect(buf).toBeInstanceOf(Buffer);
    const decoded = await decodeBatch(buf);
    expect(decoded).toHaveLength(2);
    expect(decoded[0]!.entityId).toBe('a');
    expect(decoded[1]!.entityId).toBe('b');
  });
});

// ── subject parsing ──────────────────────────────────────────────────────────

describe('makeSubject / parseSubject', () => {
  it('roundtrips subject fields', () => {
    const fields = { nodeId: 'n1', tenantId: 't1', vesselId: 'v1', hlc: '2026-01-01' };
    const subject = makeSubject(fields);
    expect(subject).toContain(SMTP_SUBJECT_PREFIX);
    const parsed = parseSubject(subject);
    expect(parsed).toEqual(fields);
  });

  it('returns null for non-sync subjects', () => {
    expect(parseSubject('Weekly newsletter')).toBeNull();
    expect(parseSubject(SMTP_SUBJECT_PREFIX)).toBeNull(); // missing fields
  });
});

// ── transport ────────────────────────────────────────────────────────────────

describe('SmtpSyncTransport', () => {
  it('encodes, sends, and decodes a batch roundtrip', async () => {
    const provider = new InMemoryMailProvider();
    const transport = new SmtpSyncTransport(BASE_OPTS, provider);

    const received: SyncDelta[] = [];
    await transport.start(async (d) => {
      received.push(d);
    });

    await transport.send([delta('p1')]);
    await transport.flush();

    const sent = provider.sentMail();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toContain('node=node-vessel-01');
    expect(sent[0]!.subject).toContain('tenant=tenant-abc');
    expect(sent[0]!.subject).toContain('vessel=vessel-xyz');
    expect(sent[0]!.from).toBe('vessel@example.com');
    expect(sent[0]!.to).toBe('shore@example.com');

    // Simulate the shore delivering the batch back to this transport.
    await provider.deliver(sent[0]!);
    expect(received).toHaveLength(1);
    expect(received[0]!.entityId).toBe('p1');

    await transport.close();
  });

  it('chunks batches larger than maxBatchSize', async () => {
    const provider = new InMemoryMailProvider();
    const transport = new SmtpSyncTransport({ ...BASE_OPTS, maxBatchSize: 3 }, provider);
    await transport.start(async () => {});

    const deltas = Array.from({ length: 7 }, (_, i) => delta(`p${i}`));
    await transport.send(deltas);
    await transport.flush();

    // 7 / 3 → emails of size 3, 3, 1
    expect(provider.sentMail()).toHaveLength(3);
    await transport.close();
  });

  it('does a final flush on close when queue is non-empty', async () => {
    const provider = new InMemoryMailProvider();
    const transport = new SmtpSyncTransport(BASE_OPTS, provider);
    await transport.start(async () => {});

    await transport.send([delta('p1')]);
    await transport.close();

    expect(provider.sentMail()).toHaveLength(1);
  });

  it('rejects send after close', async () => {
    const provider = new InMemoryMailProvider();
    const transport = new SmtpSyncTransport(BASE_OPTS, provider);
    await transport.start(async () => {});
    await transport.close();

    await expect(transport.send([delta('x')])).rejects.toThrow('closed');
  });

  it('skips corrupted attachments without throwing', async () => {
    const provider = new InMemoryMailProvider();
    const transport = new SmtpSyncTransport(BASE_OPTS, provider);

    const received: SyncDelta[] = [];
    await transport.start(async (d) => {
      received.push(d);
    });

    await provider.deliver({
      from: 'shore@example.com',
      to: 'vessel@example.com',
      subject: `${SMTP_SUBJECT_PREFIX}|node=n|tenant=t|vessel=v|hlc=0`,
      attachmentData: Buffer.from('not-valid-gzip'),
      attachmentName: 'bad.bin',
    });

    expect(received).toHaveLength(0);
    await transport.close();
  });

  it('ignores envelopes with non-sync subjects', async () => {
    const provider = new InMemoryMailProvider();
    const transport = new SmtpSyncTransport(BASE_OPTS, provider);

    const received: SyncDelta[] = [];
    await transport.start(async (d) => {
      received.push(d);
    });

    await provider.deliver({
      from: 'x@x.com',
      to: 'y@y.com',
      subject: 'Monthly newsletter',
      attachmentData: Buffer.alloc(0),
      attachmentName: 'news.pdf',
    });

    expect(received).toHaveLength(0);
    await transport.close();
  });

  it('flush is a no-op when queue is empty', async () => {
    const provider = new InMemoryMailProvider();
    const transport = new SmtpSyncTransport(BASE_OPTS, provider);
    await transport.start(async () => {});
    await transport.flush();
    expect(provider.sentMail()).toHaveLength(0);
    await transport.close();
  });
});
