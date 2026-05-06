#!/usr/bin/env node
// Generate an RS256 keypair for shore JWT signing / vessel verification.
//
// Outputs PEM files into ./keys (relative to repo root):
//   - jwt-private.pem  → loaded by shore (JWT_PRIVATE_KEY_PATH)
//   - jwt-public.pem   → distributed to every vessel (JWT_PUBLIC_KEY_PATH)
//
// The private key never leaves shore. The public key is safe to commit if
// you so choose; we gitignore both folders by default to keep the
// development pair off the repo and require an explicit decision per
// environment.

import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const keysDir = join(root, 'keys');
mkdirSync(keysDir, { recursive: true });

const privPath = join(keysDir, 'jwt-private.pem');
const pubPath = join(keysDir, 'jwt-public.pem');

if (existsSync(privPath) || existsSync(pubPath)) {
  console.error(`Refusing to overwrite existing keys in ${keysDir}.`);
  console.error('Delete them manually if you really want a fresh pair.');
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(privPath, privateKey, { mode: 0o600 });
writeFileSync(pubPath, publicKey, { mode: 0o644 });

console.log('Wrote:');
console.log(`  ${privPath}  (mode 600 — keep secret on shore)`);
console.log(`  ${pubPath}   (distribute to every vessel)`);
console.log('');
console.log('Set in shore .env:');
console.log(`  JWT_PRIVATE_KEY_PATH=${privPath}`);
console.log(`  JWT_PUBLIC_KEY_PATH=${pubPath}`);
console.log('');
console.log('Set in vessel .env:');
console.log(`  JWT_PUBLIC_KEY_PATH=${pubPath}`);
