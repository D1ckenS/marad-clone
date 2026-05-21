// Visits the Electron-bundled SPA on its own renderer port (auto-detected from
// `[desktop] renderer on :<port>` in electron.log). Doesn't drive Electron via
// IPC — it just confirms the bundled SPA serves a clean app and the proxied
// /api/* requests succeed end-to-end.

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', '.smoke-results');
mkdirSync(OUT, { recursive: true });

const log = readFileSync(path.join(OUT, 'electron.log'), 'utf8');
const m = log.match(/renderer on :(\d+)/);
if (!m) {
  console.error('Could not find renderer port in electron.log');
  process.exit(1);
}
const port = m[1];
const URL = `http://127.0.0.1:${port}`;
console.log(`Targeting Electron renderer at ${URL}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const pageErrors = [];
const consoleErrors = [];
const netFails = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 600)));
page.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text().slice(0, 600)));
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) {
    netFails.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  }
});

await page.goto(`${URL}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.locator('#identifier').fill('zyad');
await page.locator('#password').fill('abm12345');
await page
  .getByRole('button', { name: /sign in/i })
  .first()
  .click();
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);
console.log('  after login URL:', page.url());
await page.screenshot({ path: path.join(OUT, 'electron-dashboard.png'), fullPage: true });

// Visit a few key pages too
for (const p of [
  'maintenance',
  'inventory',
  'safety',
  'qhse',
  'certificates',
  'flgo',
  'compliance',
]) {
  await page.goto(`${URL}/${p === 'maintenance' ? 'components' : p}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `electron-${p}.png`), fullPage: true });
}

await browser.close();

const report = { url: URL, pageErrors, consoleErrors, netFails };
writeFileSync(path.join(OUT, 'electron-findings.json'), JSON.stringify(report, null, 2));
console.log(
  `✓ Electron-served SPA: ${pageErrors.length} page errors, ${consoleErrors.length} console errors, ${netFails.length} 4xx/5xx`,
);
if (pageErrors.length) for (const e of pageErrors) console.log('  pageErr:', e);
if (netFails.length) for (const e of netFails.slice(0, 10)) console.log('  net:', e);
