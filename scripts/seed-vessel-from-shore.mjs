// Dockside provisioning: takes a connected shore + an empty vessel SQLite
// file path and seeds the vessel with the tenant's users so the laptop can
// be unplugged and sailed.
//
// Usage:
//
//   node scripts/seed-vessel-from-shore.mjs \
//     --shore http://localhost:3000 \
//     --shore-admin <SHORE_ADMIN_USERNAME> --shore-password <SHORE_ADMIN_PASSWORD> \
//     --tenant 01KQWX2HPGZBJJR9Z8W53SQJM4 \
//     --vessel 01KRTJPG2MZK2HZ78AT6KXEP0Y \
//     --temp-password ChangeMe2026! \
//     --vessel-db "%APPDATA%/@fleetops/desktop-vessel/vessel.db" \
//     --migrations apps/desktop-vessel/api-vessel-bundle/drizzle
//
// Notes:
//   - Every seeded user gets the same temporary password (`--temp-password`).
//     Hand the list of "username → temp password" to the crew physically and
//     have each user change it after first login.
//   - The script connects to shore over HTTP — no direct DB access needed.
//     Shore must be reachable from the dockside laptop.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { argv, exit } from 'node:process';
import { createRequire } from 'node:module';

function parseArgs() {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[k] = true;
    } else {
      out[k] = next;
      i++;
    }
  }
  return out;
}

const args = parseArgs();
const required = [
  'shore',
  'shore-admin',
  'shore-password',
  'tenant',
  'temp-password',
  'vessel-db',
  'migrations',
];
for (const r of required) {
  if (!args[r]) {
    console.error(`Missing required arg --${r}`);
    console.error('Run with no args to see usage at the top of this file.');
    exit(2);
  }
}

const shoreBase = args.shore.replace(/\/$/, '');

async function shoreFetch(pathPart, opts = {}) {
  const r = await fetch(`${shoreBase}/api/v1${pathPart}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`shore ${pathPart} -> ${r.status} ${text.slice(0, 200)}`);
  }
  return r.json();
}

console.log(`[seed-vessel] logging into shore at ${shoreBase} as ${args['shore-admin']}…`);
const login = await shoreFetch('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ identifier: args['shore-admin'], password: args['shore-password'] }),
});
const adminToken = login.access_token;
if (!adminToken) throw new Error('shore login returned no access_token');

console.log(`[seed-vessel] fetching tenant ${args.tenant}…`);
const tenant = await shoreFetch(`/tenants/${args.tenant}`, {
  headers: { Authorization: `Bearer ${adminToken}` },
});

console.log(`[seed-vessel] fetching users for tenant…`);
const users = await shoreFetch(`/tenants/${args.tenant}/users`, {
  headers: { Authorization: `Bearer ${adminToken}` },
});
console.log(`[seed-vessel]   found ${users.length} users`);

let vessel = null;
if (args.vessel) {
  console.log(`[seed-vessel] fetching vessel ${args.vessel}…`);
  vessel = await shoreFetch(`/vessels/${args.vessel}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

// ── Write to local SQLite via better-sqlite3 + drizzle migrate ────────────
const vesselDb = args['vessel-db'].replace(/^%APPDATA%/i, process.env.APPDATA ?? '');
mkdirSync(path.dirname(vesselDb), { recursive: true });

// Find the bundled better-sqlite3 (electron-rebuilt or any Node-ABI build).
// We try the desktop bundle first (matches the runtime), then fall back to
// the dev workspace.
const require = createRequire(import.meta.url);
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('[seed-vessel] could not load better-sqlite3 — run `pnpm install` first');
  throw e;
}

console.log(`[seed-vessel] opening ${vesselDb}…`);
const db = new Database(vesselDb);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Apply migrations so the schema is up to date.
console.log(`[seed-vessel] applying migrations from ${args.migrations}…`);
try {
  const drizzle = require('drizzle-orm/better-sqlite3');
  const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
  const wrapped = drizzle.drizzle(db);
  migrate(wrapped, { migrationsFolder: path.resolve(args.migrations) });
} catch (e) {
  console.error('[seed-vessel] migration failed — proceed only if the schema is already current');
  throw e;
}

// Crypto setup — bcrypt is heavy; we use the same hash rounds as api-vessel.
let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  console.error('[seed-vessel] could not load bcrypt');
  throw e;
}
const SALT_ROUNDS = 12;
const tempHash = await bcrypt.hash(args['temp-password'], SALT_ROUNDS);

// Idempotent upserts.
const nowIso = () => new Date().toISOString();
const upsertTenant = db.prepare(
  `INSERT INTO tenants (id, name, created_at, updated_at)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
);
const upsertVessel = db.prepare(
  `INSERT INTO vessels (id, tenant_id, name, imo_number, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET name = excluded.name, imo_number = excluded.imo_number, updated_at = excluded.updated_at`,
);
const upsertUser = db.prepare(
  `INSERT INTO users (id, tenant_id, vessel_id, email, password_hash, role, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(tenant_id, email) DO UPDATE SET role = excluded.role, vessel_id = excluded.vessel_id, updated_at = excluded.updated_at`,
);

const now = nowIso();
const tx = db.transaction(() => {
  upsertTenant.run(tenant.id, tenant.name, now, now);
  if (vessel) {
    upsertVessel.run(vessel.id, vessel.tenantId, vessel.name, vessel.imoNumber ?? null, now, now);
  }
  for (const u of users) {
    if (u.role === 'SUPER_ADMIN') continue; // platform admins don't sail
    // Only seed users assigned to this vessel (or unassigned fleet-wide users).
    if (args.vessel && u.vesselId && u.vesselId !== args.vessel) continue;
    upsertUser.run(
      u.id,
      u.tenantId,
      u.vesselId ?? args.vessel ?? null,
      u.email,
      tempHash, // temporary password — user must change after first login
      u.role,
      now,
      now,
    );
  }
});
tx();

const rowCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
db.close();

console.log(`[seed-vessel] done. ${rowCount} users now in ${vesselDb}.`);
console.log(
  `[seed-vessel] all seeded users share the temporary password: ${args['temp-password']}`,
);
console.log('[seed-vessel] each user must change it after first login.');
