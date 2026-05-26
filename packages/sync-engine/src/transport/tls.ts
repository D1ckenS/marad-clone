// TLS material loading + credentials factories for the gRPC sync transport (B1).
//
// Reads three env vars:
//
//   SYNC_TLS_CA_PATH    — root CA bundle (both ends trust this)
//   SYNC_TLS_CERT_PATH  — own leaf cert (shore-server.crt on shore, vessel-client.crt on vessel)
//   SYNC_TLS_KEY_PATH   — own private key matching the leaf cert
//
// Behaviour:
//   - all three set         → mutual TLS (vessel must present a client cert)
//   - all three unset       → insecure (DEV / TEST only)
//   - partial config        → throws (failing loudly beats a confusing wire)
//   - NODE_ENV=production AND any missing → throws (refuse-to-boot per the
//     production readiness audit B1)
//
// Production deployment plugs the env vars into the systemd unit /
// Docker compose / k8s secret mount; the cert files are owned by the
// process user with 0600 perms. Dev runs without TLS by leaving the vars
// unset; the scripts/gen-sync-tls.mjs helper produces a self-signed
// fleet-of-three for anyone who wants to exercise the TLS path locally.

import * as fs from 'node:fs';
import * as grpc from '@grpc/grpc-js';

const ENV_CA = 'SYNC_TLS_CA_PATH';
const ENV_CERT = 'SYNC_TLS_CERT_PATH';
const ENV_KEY = 'SYNC_TLS_KEY_PATH';

export interface SyncTlsMaterial {
  ca: Buffer;
  cert: Buffer;
  key: Buffer;
}

/**
 * Reads SYNC_TLS_* paths from process.env, validates the all-or-nothing
 * rule, and returns either the loaded material or null (insecure mode).
 *
 * Throws in production if any path is missing, and throws in any
 * environment if the three vars are partially set.
 */
export function loadSyncTlsMaterial(): SyncTlsMaterial | null {
  const caPath = process.env[ENV_CA];
  const certPath = process.env[ENV_CERT];
  const keyPath = process.env[ENV_KEY];

  const set = [caPath, certPath, keyPath].filter((v) => v !== undefined && v.trim() !== '');
  const allSet = set.length === 3;
  const noneSet = set.length === 0;

  if (!allSet) {
    if (process.env['NODE_ENV'] === 'production') {
      const missing: string[] = [];
      if (!caPath || caPath.trim() === '') missing.push(ENV_CA);
      if (!certPath || certPath.trim() === '') missing.push(ENV_CERT);
      if (!keyPath || keyPath.trim() === '') missing.push(ENV_KEY);
      throw new Error(
        `Sync gRPC TLS is required in production — missing env: ${missing.join(', ')}. ` +
          `Provision a dev CA via scripts/gen-sync-tls.mjs or wire real certs.`,
      );
    }
    if (!noneSet) {
      throw new Error(
        `Sync gRPC TLS env vars must be ALL set or ALL unset. ` +
          `Got: ${ENV_CA}=${caPath ?? '∅'}, ${ENV_CERT}=${certPath ?? '∅'}, ${ENV_KEY}=${keyPath ?? '∅'}`,
      );
    }
    return null;
  }

  return {
    // The non-null assertions are safe because `allSet` proves all three are set.
    ca: fs.readFileSync(caPath!),
    cert: fs.readFileSync(certPath!),
    key: fs.readFileSync(keyPath!),
  };
}

/**
 * Server-side credentials for the shore gRPC gateway. mTLS — vessels must
 * present a client cert signed by the shared CA.
 */
export function syncServerCredentials(): grpc.ServerCredentials {
  const m = loadSyncTlsMaterial();
  if (m === null) return grpc.ServerCredentials.createInsecure();
  return grpc.ServerCredentials.createSsl(
    m.ca,
    [{ private_key: m.key, cert_chain: m.cert }],
    /* checkClientCertificate */ true,
  );
}

/**
 * Client-side credentials for the vessel gRPC client (sync transport and
 * the blob uploader's separate channel both call this).
 */
export function syncClientCredentials(): grpc.ChannelCredentials {
  const m = loadSyncTlsMaterial();
  if (m === null) return grpc.credentials.createInsecure();
  return grpc.credentials.createSsl(m.ca, m.key, m.cert);
}
