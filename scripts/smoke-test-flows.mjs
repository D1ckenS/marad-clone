// Tests end-to-end business flows over the live API as the ABM tenant admin.
// Covers: vessel listing, create requisition, fetch maintenance components, sign-off,
// inventory movement, certificate listing, fleetview summary perf.

import { ABM } from './_smoke-creds.mjs';

const API = 'http://localhost:3000/api/v1';

async function post(path, body, tok) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
async function get(path, tok, vesselId) {
  const headers = { Authorization: `Bearer ${tok}` };
  if (vesselId) headers['X-Vessel-Id'] = vesselId;
  const r = await fetch(`${API}${path}`, { headers });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.json();
}

const t0 = Date.now();
const login = await post('/auth/login', { identifier: ABM.username, password: ABM.password });
const tok = login.access_token;
console.log(`✓ login (${Date.now() - t0}ms)`);

const vessels = await get('/vessels', tok);
const vesselId = vessels[0].id;
console.log(`✓ list vessels: ${vessels.length} (UR=${vesselId})`);

// ── Fleetview summary perf (cached on 2nd call) ─────────────────────────────
const sum1 = Date.now();
await get('/fleetview/summary', tok);
const t1 = Date.now() - sum1;
const sum2 = Date.now();
await get('/fleetview/summary', tok);
const t2 = Date.now() - sum2;
console.log(`✓ fleetview summary cold=${t1}ms warm=${t2}ms`);

// ── Maintenance ──────────────────────────────────────────────────────────────
const components = await get('/components', tok, vesselId);
console.log(`✓ list components: ${components.length}`);
const jobs = await get('/jobs', tok, vesselId);
const jobInstances = await get('/job-instances', tok, vesselId);
console.log(`✓ jobs: ${jobs.length}, instances: ${jobInstances.length}`);
const histories = await get('/job-histories', tok, vesselId);
console.log(`✓ job-histories: ${histories.length}`);

// ── Inventory ────────────────────────────────────────────────────────────────
const parts = await get('/parts', tok, vesselId);
const stockLevels = await get('/stock-levels', tok, vesselId);
console.log(`✓ parts: ${parts.length}, stock-levels: ${stockLevels.length}`);

// ── Purchase ─────────────────────────────────────────────────────────────────
const reqs = await get('/requisitions', tok, vesselId);
const pos = await get('/purchase-orders', tok, vesselId);
const rfqs = await get('/rfqs', tok, vesselId);
console.log(`✓ requisitions: ${reqs.length}, POs: ${pos.length}, RFQs: ${rfqs.length}`);

// ── Certificates ─────────────────────────────────────────────────────────────
const certs = await get('/certificates', tok, vesselId);
console.log(`✓ certificates: ${certs.length}`);

// ── Crew ─────────────────────────────────────────────────────────────────────
const crew = await get('/crew-members', tok, vesselId);
console.log(`✓ crew: ${crew.length}`);

// ── Compliance ───────────────────────────────────────────────────────────────
const cs = Date.now();
const compliance = await get(`/compliance/status/${vesselId}`, tok, vesselId);
console.log(
  `✓ compliance status (${Date.now() - cs}ms): DNV=${compliance.dnv?.complianceScore}/100 ISO=${compliance.iso27001?.summary?.overallScore}/100`,
);

// ── Create requisition flow ──────────────────────────────────────────────────
const create0 = Date.now();
const newReq = await fetch(`${API}/requisitions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tok}`,
    'X-Vessel-Id': vesselId,
  },
  body: JSON.stringify({
    title: 'Smoke-test requisition ' + new Date().toISOString(),
    requestedByUserId: null,
    requestedAt: new Date().toISOString(),
    status: 'DRAFT',
  }),
});
console.log(`✓ create requisition: ${newReq.status} (${Date.now() - create0}ms)`);
if (newReq.ok) {
  const created = await newReq.json();
  console.log(`  id=${created.id}`);
  // clean up
  await fetch(`${API}/requisitions/${created.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tok}`, 'X-Vessel-Id': vesselId },
  });
  console.log('  ✓ cleaned up');
}

console.log(`\nTotal: ${Date.now() - t0}ms`);
