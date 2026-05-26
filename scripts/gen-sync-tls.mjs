#!/usr/bin/env node
// Generate a self-signed CA + shore server cert + vessel client cert for
// the gRPC sync transport (B1). Outputs PEM files into ./keys/sync-tls
// (relative to repo root):
//
//   ca.crt           → trust root, both shore and vessel reference it
//   ca.key           → CA private key; needed only to issue more certs
//   shore.crt
//   shore.key        → shore server identity (mode 600)
//   vessel.crt
//   vessel.key       → vessel client identity (mode 600)
//
// Wire as:
//
//   shore  .env:  SYNC_TLS_CA_PATH=…/keys/sync-tls/ca.crt
//                 SYNC_TLS_CERT_PATH=…/keys/sync-tls/shore.crt
//                 SYNC_TLS_KEY_PATH=…/keys/sync-tls/shore.key
//
//   vessel .env:  SYNC_TLS_CA_PATH=…/keys/sync-tls/ca.crt
//                 SYNC_TLS_CERT_PATH=…/keys/sync-tls/vessel.crt
//                 SYNC_TLS_KEY_PATH=…/keys/sync-tls/vessel.key
//
// This is the DEV path. In production, sign the leaf certs from your real
// internal CA (or DigiCert/etc.), keep the CA key off any prod host, and
// rotate per apps/docs/runbooks/sync-tls-rotation.md.

import forge from 'node-forge';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'keys', 'sync-tls');

if (existsSync(outDir)) {
  console.error(`Refusing to overwrite existing certs in ${outDir}.`);
  console.error('Delete the directory manually if you really want a fresh set.');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

function makeCa() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + ONE_YEAR_MS);
  const subject = [
    { name: 'commonName', value: 'fleetops-sync-dev-ca' },
    { name: 'organizationName', value: 'FleetOps (dev)' },
  ];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert, key: keys.privateKey };
}

function makeLeaf({ ca, role, commonName, sans }) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = String(Math.floor(Math.random() * 1e9));
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + ONE_YEAR_MS);
  cert.setSubject([
    { name: 'commonName', value: commonName },
    { name: 'organizationName', value: 'FleetOps (dev)' },
  ]);
  cert.setIssuer(ca.cert.subject.attributes);
  const altNames = sans.map((name) =>
    /^\d+\.\d+\.\d+\.\d+$/.test(name) ? { type: 7, ip: name } : { type: 2, value: name },
  );
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    {
      name: 'extKeyUsage',
      serverAuth: role === 'server',
      clientAuth: role === 'client',
    },
    { name: 'subjectAltName', altNames },
  ]);
  cert.sign(ca.key, forge.md.sha256.create());
  return { cert, key: keys.privateKey };
}

const ca = makeCa();
const shore = makeLeaf({
  ca,
  role: 'server',
  commonName: 'shore.fleetops.local',
  sans: ['localhost', '127.0.0.1', 'shore.fleetops.local'],
});
const vessel = makeLeaf({
  ca,
  role: 'client',
  commonName: 'vessel-001.fleetops.local',
  sans: ['vessel-001.fleetops.local'],
});

const write = (name, content, mode) => {
  const p = join(outDir, name);
  writeFileSync(p, content, { mode });
  return p;
};

const files = {
  caCrt: write('ca.crt', forge.pki.certificateToPem(ca.cert), 0o644),
  caKey: write('ca.key', forge.pki.privateKeyToPem(ca.key), 0o600),
  shoreCrt: write('shore.crt', forge.pki.certificateToPem(shore.cert), 0o644),
  shoreKey: write('shore.key', forge.pki.privateKeyToPem(shore.key), 0o600),
  vesselCrt: write('vessel.crt', forge.pki.certificateToPem(vessel.cert), 0o644),
  vesselKey: write('vessel.key', forge.pki.privateKeyToPem(vessel.key), 0o600),
};

console.log('Wrote:');
for (const [k, v] of Object.entries(files)) console.log(`  ${v}  (${k})`);
console.log('');
console.log('Set in shore .env:');
console.log(`  SYNC_TLS_CA_PATH=${files.caCrt}`);
console.log(`  SYNC_TLS_CERT_PATH=${files.shoreCrt}`);
console.log(`  SYNC_TLS_KEY_PATH=${files.shoreKey}`);
console.log('');
console.log('Set in vessel .env:');
console.log(`  SYNC_TLS_CA_PATH=${files.caCrt}`);
console.log(`  SYNC_TLS_CERT_PATH=${files.vesselCrt}`);
console.log(`  SYNC_TLS_KEY_PATH=${files.vesselKey}`);
console.log('');
console.log('Validity: 1 year. Rotate per apps/docs/runbooks/sync-tls-rotation.md.');
