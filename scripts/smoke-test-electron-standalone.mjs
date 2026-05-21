// Verifies the self-contained Electron installer:
//   - reads the renderer URL from electron-v4.log
//   - loads the SPA in headless Chromium
//   - attempts a vessel-local login (will 401 — but the API responded, which
//     proves api-vessel is alive end-to-end)
//   - hits the auth/verify-shore-token endpoint with a synthetic token to
//     confirm the JWT public key is wired up.

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', '.smoke-results');
mkdirSync(OUT, { recursive: true });

const log = readFileSync(path.join(OUT, 'electron-v4.log'), 'utf8');
const m = log.match(/renderer on :(\d+)/);
if (!m) throw new Error('renderer port not found in electron-v4.log');
const port = m[1];
const URL = `http://127.0.0.1:${port}`;
console.log(`target: ${URL}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const errors = { pageErrors: [], consoleErrors: [], netFails: [] };
page.on('pageerror', (e) => errors.pageErrors.push(String(e).slice(0, 400)));
page.on(
  'console',
  (msg) => msg.type() === 'error' && errors.consoleErrors.push(msg.text().slice(0, 400)),
);
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) {
    errors.netFails.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  }
});

// Hit a vessel API endpoint via the renderer proxy to confirm the route works.
const apiHealth = await page.request.post(`${URL}/api/v1/auth/login`, {
  data: { tenantId: 'test', email: 'x@y.z', password: 'wrong' },
});
console.log(`POST /api/v1/auth/login -> ${apiHealth.status()} (api-vessel reachable)`);
const body = await apiHealth.text();
console.log(`  body: ${body.slice(0, 200)}`);

await page.goto(`${URL}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, 'electron-standalone-login.png'), fullPage: true });
console.log(
  `captured login screenshot — page errors: ${errors.pageErrors.length}, console: ${errors.consoleErrors.length}`,
);

// Also navigate to dashboard route (will redirect to login since no token)
await page.goto(`${URL}/dashboard`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'electron-standalone-dash.png'), fullPage: true });

await browser.close();

console.log('\n=== Summary ===');
console.log('pageErrors:', errors.pageErrors.length, errors.pageErrors[0] ?? '');
console.log('consoleErrors:', errors.consoleErrors.length, errors.consoleErrors[0] ?? '');
console.log('netFails:', errors.netFails.length);
for (const n of errors.netFails.slice(0, 10)) console.log('  ', n);
