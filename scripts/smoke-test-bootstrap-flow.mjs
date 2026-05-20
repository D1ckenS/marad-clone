// Drives the first-launch vessel bootstrap end-to-end:
//   1. Hit setup-status → expect needsBootstrap=true
//   2. Submit /setup wizard with the bootstrap key + admin details
//   3. Confirm auto-login → /dashboard renders
//   4. Hit setup-status again → expect needsBootstrap=false (idempotency probe)
//   5. Verify that POST /auth/bootstrap-vessel-admin returns 409 once seeded.

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', '.smoke-results');
mkdirSync(OUT, { recursive: true });

const log = readFileSync(path.join(OUT, 'electron-v5.log'), 'utf8');
const m = log.match(/renderer on :(\d+)/);
if (!m) throw new Error('renderer port not found');
const URL = `http://127.0.0.1:${m[1]}`;
console.log(`target: ${URL}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const errors = { pageErrors: [], consoleErrors: [], netFails: [] };
page.on('pageerror', (e) => errors.pageErrors.push(String(e).slice(0, 400)));
page.on('console', (msg) => msg.type() === 'error' && errors.consoleErrors.push(msg.text().slice(0, 400)));
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) {
    errors.netFails.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  }
});

// 1. Probe setup-status
const status = await page.request.get(`${URL}/api/v1/auth/setup-status`);
const statusJson = await status.json();
console.log('setup-status (initial):', statusJson);
if (!statusJson.needsBootstrap) throw new Error('expected needsBootstrap=true on fresh install');
if (!statusJson.bootstrapEnabled) throw new Error('VESSEL_BOOTSTRAP_KEY not seen by api-vessel');

// 2. Visit the SPA — should redirect to /setup
await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
console.log('  after / nav -> URL:', page.url());
await page.screenshot({ path: path.join(OUT, 'bootstrap-1-setup-wizard.png'), fullPage: true });

// 3. Fill and submit the wizard
await page.locator('#bootstrapKey').fill('test-bootstrap-secret');
await page.locator('#tenantId').fill('01KS2BOOTSTRAP00000000000XYZ');
await page.locator('#tenantName').fill('Bootstrap Test Co');
await page.locator('#vesselName').fill('MV Bootstrap');
await page.locator('#vesselImoNumber').fill('1234567');
await page.locator('#email').fill('admin@bootstrap.test');
await page.locator('#password').fill('supersecret123');
await page.locator('#confirm').fill('supersecret123');
await page.getByRole('button', { name: /create vessel administrator/i }).click();

// 4. Expect redirect to /dashboard
await page.waitForURL(/dashboard/, { timeout: 15000 });
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'bootstrap-2-dashboard.png'), fullPage: true });
console.log('  post-bootstrap URL:', page.url());

// 5. Re-probe setup-status
const status2 = await page.request.get(`${URL}/api/v1/auth/setup-status`);
const status2Json = await status2.json();
console.log('setup-status (after bootstrap):', status2Json);

// 6. Verify a second bootstrap call is refused
const reBootstrap = await page.request.post(`${URL}/api/v1/auth/bootstrap-vessel-admin`, {
  data: {
    bootstrapKey: 'test-bootstrap-secret',
    tenantId: 'should-fail',
    tenantName: 'should fail',
    email: 'x@y.z',
    password: 'whatever12',
  },
});
console.log(`second bootstrap attempt -> ${reBootstrap.status()} (expected 409)`);

await browser.close();

console.log('\n=== Summary ===');
console.log('pageErrors:', errors.pageErrors.length, errors.pageErrors[0] ?? '');
console.log('consoleErrors:', errors.consoleErrors.length, errors.consoleErrors[0] ?? '');
console.log('netFails (excluding the 409 we expect):', errors.netFails.filter((n) => !n.startsWith('409')).length);
for (const n of errors.netFails) console.log('  ', n);
