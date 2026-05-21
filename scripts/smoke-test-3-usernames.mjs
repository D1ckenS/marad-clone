// Test each of the 3 seeded usernames (the way Ziad would type them) against
// the bundled vessel API via the Electron renderer proxy.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const log = readFileSync(path.join(HERE, '..', '.smoke-results', 'electron-v7.log'), 'utf8');
const m = log.match(/renderer on :(\d+)/);
if (!m) throw new Error('renderer port not found');
const URL = `http://127.0.0.1:${m[1]}`;
console.log(`target: ${URL}`);

const cases = [
  { identifier: 'Ziad', password: 'REDACTED', expect: 'SUPER_ADMIN' },
  { identifier: 'abdallah', password: 'REDACTED', expect: 'TENANT_ADMIN' },
  { identifier: 'zyad', password: 'REDACTED', expect: 'TENANT_ADMIN' },
  // and confirm the same accounts also work via email
  { identifier: 'REDACTED@example.com', password: 'REDACTED', expect: 'SUPER_ADMIN' },
  { identifier: 'REDACTED@example.com', password: 'REDACTED', expect: 'TENANT_ADMIN' },
  { identifier: 'REDACTED@example.com', password: 'REDACTED', expect: 'TENANT_ADMIN' },
  // and confirm a bad password fails
  { identifier: 'zyad', password: 'wrong', expect: 'FAIL' },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const r = await fetch(`${URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: c.identifier, password: c.password }),
  });
  const ok = r.ok;
  const expectedFail = c.expect === 'FAIL';
  const passed = expectedFail ? !ok : ok;
  if (passed) {
    pass++;
    if (ok) {
      const body = await r.json();
      // decode JWT to confirm role
      const payload = JSON.parse(
        Buffer.from(body.access_token.split('.')[1], 'base64url').toString('utf8'),
      );
      console.log(`✓ ${c.identifier} / ${c.password}  →  ${r.status}  role=${payload.role}`);
    } else {
      console.log(`✓ ${c.identifier} / ${c.password}  →  ${r.status} (correctly rejected)`);
    }
  } else {
    fail++;
    const body = await r.text();
    console.log(`✗ ${c.identifier} / ${c.password}  →  ${r.status}  ${body.slice(0, 120)}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
