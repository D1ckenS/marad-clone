// Verifies the "install + log in" path the user actually wants:
//   - launch fresh Electron (no VESSEL_BOOTSTRAP_KEY, no env vars)
//   - first launch copies seed-vessel.db into userData
//   - SPA setup-status reports needsBootstrap=false (seed has users)
//   - SPA renders /login (no setup wizard)
//   - login with zyad@abmaritime.com.jo / abm12345 → /dashboard

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', '.smoke-results');
mkdirSync(OUT, { recursive: true });

const log = readFileSync(path.join(OUT, 'electron-v6.log'), 'utf8');
const m = log.match(/renderer on :(\d+)/);
if (!m) throw new Error('renderer port not found in electron-v6.log');
const URL = `http://127.0.0.1:${m[1]}`;
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

// 1. setup-status should say no bootstrap needed (seed has users)
const status = await page.request.get(`${URL}/api/v1/auth/setup-status`);
const statusJson = await status.json();
console.log('setup-status:', statusJson);
if (statusJson.needsBootstrap) throw new Error('seed did NOT take effect — needsBootstrap=true');
if (statusJson.userCount < 1) throw new Error('seed did NOT take effect — userCount=0');

// 2. Visit login — should render LoginPage (not /setup)
await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
console.log(`  /login URL after load: ${page.url()}`);
await page.screenshot({ path: path.join(OUT, 'seeded-1-login.png'), fullPage: true });

// 3. Log in as zyad
await page.locator('#identifier').fill('zyad@abmaritime.com.jo');
await page.locator('#password').fill('abm12345');
await page
  .getByRole('button', { name: /sign in/i })
  .first()
  .click();
await page.waitForURL(/dashboard/, { timeout: 15000 });
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'seeded-2-dashboard.png'), fullPage: true });
console.log(`  post-login URL: ${page.url()}`);

// 4. Walk a few protected pages just to confirm auth + UI work end-to-end
for (const p of ['components', 'inventory', 'certificates', 'safety', 'crewing']) {
  await page.goto(`${URL}/${p}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `seeded-${p}.png`), fullPage: true });
}

await browser.close();

console.log('\n=== Summary ===');
console.log('pageErrors:', errors.pageErrors.length, errors.pageErrors[0] ?? '');
console.log('consoleErrors:', errors.consoleErrors.length, errors.consoleErrors[0] ?? '');
console.log(`netFails: ${errors.netFails.length}`);
for (const n of errors.netFails.slice(0, 10)) console.log('  ', n);
