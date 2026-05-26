// Comprehensive UI smoke test driven by Playwright.
// Walks every shore web page as zyad (tenant admin) and Ziad (super admin),
// captures screenshots, and records console errors + failed network requests + JS exceptions.
//
// Usage: WEB=http://localhost:5342 API=http://localhost:3000 node scripts/smoke-test-web.mjs

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SUPER, ABM } from './_smoke-creds.mjs';

const WEB = process.env.WEB || 'http://localhost:5342';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', '.smoke-results');
mkdirSync(OUT, { recursive: true });

const tenantPages = [
  { path: 'dashboard', name: 'dashboard' },
  { path: 'components?tab=components', name: 'maintenance-components' },
  { path: 'components?tab=jobs', name: 'maintenance-jobs' },
  { path: 'components?tab=history', name: 'maintenance-history' },
  { path: 'components?tab=templates', name: 'maintenance-templates' },
  { path: 'components?tab=running-hours', name: 'maintenance-runninghours' },
  { path: 'components?tab=projects', name: 'maintenance-projects' },
  { path: 'inventory', name: 'inventory' },
  { path: 'safety?tab=find', name: 'safety-findings' },
  { path: 'safety?tab=jha', name: 'safety-jha' },
  { path: 'safety?tab=capa', name: 'safety-capa' },
  { path: 'qhse?tab=audit', name: 'qhse-audit' },
  { path: 'qhse?tab=env', name: 'qhse-env' },
  { path: 'qhse?tab=review', name: 'qhse-review' },
  { path: 'crewing?tab=rotation', name: 'crewing-rotation' },
  { path: 'crewing?tab=rest-hours', name: 'crewing-rest-hours' },
  { path: 'crewing?tab=drills', name: 'crewing-drills' },
  { path: 'flgo?tab=soundings', name: 'flgo-soundings' },
  { path: 'flgo?tab=bdn', name: 'flgo-bdn' },
  { path: 'purchase?tab=requisitions', name: 'purchase-requisitions' },
  { path: 'purchase?tab=rfq', name: 'purchase-rfqs' },
  { path: 'purchase?tab=po', name: 'purchase-pos' },
  { path: 'purchase?tab=grn', name: 'purchase-grns' },
  { path: 'purchase?tab=suppliers', name: 'purchase-suppliers' },
  { path: 'certificates', name: 'certificates' },
  { path: 'safety', name: 'safety' },
  { path: 'qhse', name: 'qhse' },
  { path: 'crewing', name: 'crewing' },
  { path: 'flgo', name: 'flgo' },
  { path: 'analytics', name: 'analytics' },
  { path: 'compliance', name: 'compliance' },
  { path: 'integrations', name: 'integrations' },
  { path: 'vessels', name: 'vessels' },
  { path: 'profile', name: 'profile' },
];

const adminPages = [
  { path: 'companies', name: 'companies' },
  { path: 'profile', name: 'profile-admin' },
];

const findings = [];

async function loginAs(page, { identifier, password }) {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.locator('#identifier').fill(identifier);
  await page.locator('#password').fill(password);
  await page
    .getByRole('button', { name: /sign in/i })
    .first()
    .click();
  await page.waitForURL(/dashboard|companies/, { timeout: 15000 });
}

async function selectFirstVessel(page) {
  try {
    // The vessel selector lives in the side nav / top bar — try clicking it then first vessel
    const selector = page
      .locator(
        '[data-testid="vessel-selector"], button:has-text("Select vessel"), select[name="vesselId"], button:has-text("vessel")',
      )
      .first();
    if (await selector.isVisible({ timeout: 1000 })) {
      await selector.click();
      const firstOption = page.locator('[role="option"], [data-vessel-option]').first();
      if (await firstOption.isVisible({ timeout: 1000 })) await firstOption.click();
    }
  } catch (_e) {
    /* best effort */
  }
}

async function visit(page, p, label) {
  const consoleErrors = [];
  const networkFails = [];
  const pageErrors = [];

  const onConsole = (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 600));
  };
  const onPageError = (e) => pageErrors.push(String(e).slice(0, 600));
  const onResponse = (r) => {
    if (r.status() >= 400 && !r.url().includes('favicon')) {
      networkFails.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    }
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);

  const t0 = Date.now();
  let crashed = false;
  try {
    await page.goto(`${WEB}/${p}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(800); // allow react-query refetches to settle
  } catch (e) {
    crashed = true;
    pageErrors.push(`navigation: ${e.message}`);
  }
  const elapsed = Date.now() - t0;

  // Screenshot
  const shot = path.join(OUT, `${label}.png`);
  try {
    await page.screenshot({ path: shot, fullPage: true });
  } catch (_e) {
    /* ignore */
  }

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  page.off('response', onResponse);

  const finding = {
    page: label,
    path: p,
    elapsedMs: elapsed,
    crashed,
    consoleErrors,
    pageErrors,
    networkFails: networkFails.filter(
      // 401/403 on attempts to fetch optional endpoints are noise we can mostly ignore,
      // but track them anyway since they may indicate role/permission gaps.
      () => true,
    ),
  };
  findings.push(finding);
  console.log(
    `[${label}] ${elapsed}ms crashed=${crashed} consoleErr=${consoleErrors.length} pageErr=${pageErrors.length} netFail=${networkFails.length}`,
  );
  if (pageErrors.length) console.log('  pageErr:', pageErrors[0]);
  if (consoleErrors.length) console.log('  console:', consoleErrors[0]);
  if (networkFails.length && networkFails.length <= 3)
    console.log('  net:', networkFails.join('\n         '));
}

const browser = await chromium.launch({ headless: true });

// ── tenant admin pass ────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  console.log(`=== Tenant admin pass (${ABM.username}) ===`);
  await loginAs(page, { identifier: ABM.username, password: ABM.password });
  await selectFirstVessel(page);
  for (const p of tenantPages) {
    await visit(page, p.path, `tenant-${p.name}`);
  }
  await ctx.close();
}

// ── super admin pass ─────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  console.log(`\n=== Super admin pass (${SUPER.username}) ===`);
  await loginAs(page, { identifier: SUPER.username, password: SUPER.password });
  for (const p of adminPages) {
    await visit(page, p.path, `admin-${p.name}`);
  }
  await ctx.close();
}

await browser.close();

writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));

// Summary
const broken = findings.filter(
  (f) => f.crashed || f.pageErrors.length > 0 || f.networkFails.some((n) => /^5\d\d/.test(n)),
);
console.log(`\n=== Summary ===`);
console.log(`Pages visited: ${findings.length}`);
console.log(`Broken (crashed/pageError/5xx): ${broken.length}`);
for (const b of broken) {
  console.log(
    `  ❌ ${b.page} — crashed=${b.crashed} pageErr=${b.pageErrors.length} 5xx=${b.networkFails.filter((n) => /^5\d\d/.test(n)).length}`,
  );
}
console.log(`\nResults: ${OUT}`);
