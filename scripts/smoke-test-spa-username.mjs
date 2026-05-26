// Drives the actual SPA login form with the ABM tenant admin username → dashboard.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ABM } from './_smoke-creds.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', '.smoke-results');
mkdirSync(OUT, { recursive: true });

const log = readFileSync(path.join(OUT, 'electron-v7.log'), 'utf8');
const m = log.match(/renderer on :(\d+)/);
if (!m) throw new Error('renderer port not found');
const URL = `http://127.0.0.1:${m[1]}`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
await page.locator('#identifier').fill(ABM.username);
await page.locator('#password').fill(ABM.password);
await page
  .getByRole('button', { name: /sign in/i })
  .first()
  .click();
await page.waitForURL(/dashboard/, { timeout: 15000 });
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'spa-username-login.png'), fullPage: true });
console.log(`✓ logged in via SPA with username '${ABM.username}' → ${page.url()}`);

await browser.close();
