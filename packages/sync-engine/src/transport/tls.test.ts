import * as grpc from '@grpc/grpc-js';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  GrpcSyncTransport,
  startSyncServer,
  syncClientCredentials,
  syncServerCredentials,
  loadSyncTlsMaterial,
} from '../index.js';
import { generateTestPki, writeTestPkiToTmp } from './test-pki.js';

const PROTO_PATH = resolve(
  fileURLToPath(import.meta.url),
  '..',
  '..',
  '..',
  '..',
  'proto',
  'sync.proto',
);

describe('Sync gRPC TLS (B1)', () => {
  const cleanup: (() => Promise<void>)[] = [];

  // Snapshot + restore the TLS env vars; many tests in this file flip them
  // to exercise the prod-refuse path and the all-vs-none rule.
  const ENV_KEYS = ['SYNC_TLS_CA_PATH', 'SYNC_TLS_CERT_PATH', 'SYNC_TLS_KEY_PATH', 'NODE_ENV'];
  const snapshot: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) snapshot[k] = process.env[k];
  });
  afterEach(async () => {
    for (const fn of cleanup.reverse()) await fn();
    cleanup.length = 0;
    for (const [k, v] of Object.entries(snapshot)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('loadSyncTlsMaterial returns null when no env vars are set (dev/test path)', () => {
    for (const k of ['SYNC_TLS_CA_PATH', 'SYNC_TLS_CERT_PATH', 'SYNC_TLS_KEY_PATH']) {
      delete process.env[k];
    }
    process.env['NODE_ENV'] = 'test';
    expect(loadSyncTlsMaterial()).toBeNull();
  });

  it('loadSyncTlsMaterial throws in production when any env var is missing', () => {
    process.env['NODE_ENV'] = 'production';
    for (const k of ['SYNC_TLS_CA_PATH', 'SYNC_TLS_CERT_PATH', 'SYNC_TLS_KEY_PATH']) {
      delete process.env[k];
    }
    expect(() => loadSyncTlsMaterial()).toThrow(/required in production/i);
  });

  it('loadSyncTlsMaterial throws when env vars are partially set', () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SYNC_TLS_CA_PATH'] = '/some/ca';
    delete process.env['SYNC_TLS_CERT_PATH'];
    delete process.env['SYNC_TLS_KEY_PATH'];
    expect(() => loadSyncTlsMaterial()).toThrow(/ALL set or ALL unset/i);
  });

  it('syncServerCredentials defaults to Insecure when env vars unset (dev)', () => {
    for (const k of ['SYNC_TLS_CA_PATH', 'SYNC_TLS_CERT_PATH', 'SYNC_TLS_KEY_PATH']) {
      delete process.env[k];
    }
    process.env['NODE_ENV'] = 'test';
    const creds = syncServerCredentials();
    // ServerCredentials.createInsecure returns an InsecureServerCredentialsImpl
    expect(creds._isSecure()).toBe(false);
  });

  it('TLS handshake succeeds with a matched mTLS cert chain', async () => {
    const pki = generateTestPki();
    const paths = writeTestPkiToTmp(pki);
    cleanup.push(paths.cleanup);

    // Server uses the shore cert; client uses the vessel cert; both trust the CA.
    process.env['SYNC_TLS_CA_PATH'] = paths.caPath;
    process.env['SYNC_TLS_CERT_PATH'] = paths.shoreCertPath;
    process.env['SYNC_TLS_KEY_PATH'] = paths.shoreKeyPath;
    const serverCreds = syncServerCredentials();

    process.env['SYNC_TLS_CERT_PATH'] = paths.vesselCertPath;
    process.env['SYNC_TLS_KEY_PATH'] = paths.vesselKeyPath;
    const clientCreds = syncClientCredentials();

    const server = await startSyncServer('127.0.0.1:0', {
      protoPath: PROTO_PATH,
      credentials: serverCreds,
      onStreamOpen: async (_hello, _send) => ({
        welcome: { cursors: {}, sessionId: 'tls-test' },
        onReceive: async () => undefined,
        onClose: async () => undefined,
      }),
    });
    cleanup.push(() => server.shutdown());

    const transport = new GrpcSyncTransport({
      protoPath: PROTO_PATH,
      // gRPC's TLS validator checks the cert SAN against the dial address.
      // Our test PKI uses 'localhost', so we must dial 'localhost', not '127.0.0.1'.
      serverAddress: `localhost:${server.port}`,
      credentials: clientCreds,
      hello: { tenantId: 'T-tls', vesselId: 'V-tls', nodeId: 'vessel-tls' },
    });
    cleanup.push(() => transport.close());

    await expect(transport.start(async () => undefined)).resolves.toBeUndefined();
  }, 15_000);

  it('insecure client cannot connect to a TLS server', async () => {
    const pki = generateTestPki();
    const paths = writeTestPkiToTmp(pki);
    cleanup.push(paths.cleanup);

    process.env['SYNC_TLS_CA_PATH'] = paths.caPath;
    process.env['SYNC_TLS_CERT_PATH'] = paths.shoreCertPath;
    process.env['SYNC_TLS_KEY_PATH'] = paths.shoreKeyPath;

    const server = await startSyncServer('127.0.0.1:0', {
      protoPath: PROTO_PATH,
      credentials: syncServerCredentials(),
      onStreamOpen: async (_hello, _send) => ({
        welcome: { cursors: {}, sessionId: 'tls-test' },
        onReceive: async () => undefined,
        onClose: async () => undefined,
      }),
    });
    cleanup.push(() => server.shutdown());

    const insecure = new GrpcSyncTransport({
      protoPath: PROTO_PATH,
      serverAddress: `127.0.0.1:${server.port}`,
      credentials: grpc.credentials.createInsecure(),
      hello: { tenantId: 'T-bad', vesselId: 'V-bad', nodeId: 'rogue' },
    });
    cleanup.push(() => insecure.close());

    // The plaintext client gets a connection-level error before Welcome ever
    // arrives. We give it a couple of seconds; gRPC's own retry can drag this
    // out otherwise.
    const startedAt = Date.now();
    let outcome: 'ok' | 'err' = 'ok';
    try {
      await Promise.race([
        insecure.start(async () => undefined),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4_000)),
      ]);
    } catch {
      outcome = 'err';
    }
    expect(outcome).toBe('err');
    expect(Date.now() - startedAt).toBeLessThan(6_000);
  }, 10_000);
});
