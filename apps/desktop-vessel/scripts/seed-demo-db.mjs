// Build-time seed: creates a fresh vessel.db pre-populated with a demo
// tenant, vessel, and a few login-ready users. Shipped in the installer as
// extraResources/api-vessel/seed-vessel.db; index.ts copies it to userData
// on first launch when no local vessel.db exists yet.
//
// Anyone who installs the .exe can immediately log in with one of these
// (login accepts either the username OR the email):
//
//   Ziad       (REDACTED@example.com)  /  REDACTED   SUPER_ADMIN  (no tenant)
//   abdallah   (REDACTED@example.com)         /  REDACTED      TENANT_ADMIN (ABM)
//   zyad       (REDACTED@example.com)      /  REDACTED      TENANT_ADMIN (ABM)
//
// No setup wizard, no env vars, no shore connection required.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_DIR = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(DESKTOP_DIR, '..', '..');
const BUNDLE_DIR = path.join(DESKTOP_DIR, 'api-vessel-bundle');
const SEED_DB = path.join(BUNDLE_DIR, 'seed-vessel.db');
const MIGRATIONS_DIR = path.join(BUNDLE_DIR, 'drizzle');

if (!existsSync(MIGRATIONS_DIR)) {
  console.error(`[seed-demo-db] migrations not found at ${MIGRATIONS_DIR}`);
  console.error('[seed-demo-db] run prepare-bundle.mjs first (it copies migrations)');
  process.exit(2);
}

// Wipe any previous seed (Windows file-locks can stick around between runs).
if (existsSync(SEED_DB)) rmSync(SEED_DB, { force: true });
for (const sfx of ['-shm', '-wal']) {
  const p = SEED_DB + sfx;
  if (existsSync(p)) rmSync(p, { force: true });
}
mkdirSync(path.dirname(SEED_DB), { recursive: true });

// Use the dev workspace's better-sqlite3 (Node-ABI). The bundle's better-sqlite3
// is Electron-ABI from the earlier rebuild and can't load under plain Node.
// Resolve from the api-vessel workspace where bcrypt and better-sqlite3 are
// installed (they're not direct deps of @fleetops/desktop-vessel).
const apiVesselReq = createRequire(path.join(REPO_ROOT, 'apps', 'api-vessel', 'package.json'));

let Database;
try {
  Database = apiVesselReq('better-sqlite3');
} catch (err) {
  console.error('[seed-demo-db] could not resolve better-sqlite3 from apps/api-vessel');
  throw err;
}

// If the cached binary is Electron-ABI (rebuilt earlier in this session),
// rebuild it back to Node-ABI just for seed time. Cheap on Windows.
try {
  new Database(':memory:');
} catch (err) {
  if (String(err).includes('NODE_MODULE_VERSION')) {
    console.log('[seed-demo-db] cached better-sqlite3 is wrong ABI; rebuilding for Node...');
    const bsqlite = path.dirname(apiVesselReq.resolve('better-sqlite3/package.json'));
    execSync(`npx --yes node-gyp rebuild --release --arch=${process.arch}`, {
      cwd: bsqlite,
      stdio: 'inherit',
    });
    // Re-load after rebuild
    delete apiVesselReq.cache[apiVesselReq.resolve('better-sqlite3')];
    Database = apiVesselReq('better-sqlite3');
  } else {
    throw err;
  }
}

let bcrypt;
try {
  bcrypt = apiVesselReq('bcrypt');
} catch (err) {
  console.error('[seed-demo-db] bcrypt not found in apps/api-vessel/node_modules', err);
  process.exit(2);
}

console.log(`[seed-demo-db] creating ${SEED_DB}…`);
const db = new Database(SEED_DB);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Apply migrations
const drizzle = apiVesselReq('drizzle-orm/better-sqlite3');
const { migrate } = apiVesselReq('drizzle-orm/better-sqlite3/migrator');
const wrapped = drizzle.drizzle(db);
migrate(wrapped, { migrationsFolder: MIGRATIONS_DIR });

// Seed rows. One tenant (ABM), one vessel (UR), three users — including the
// SUPER_ADMIN Ziad who has no tenant (matches shore design).
const TENANT_ID = '01KQWX2HPGZBJJR9Z8W53SQJM4';
const VESSEL_ID = '01KRTJPG2MZK2HZ78AT6KXEP0Y';
const now = new Date().toISOString();

const seedUsers = [
  {
    id: 'usr_ziad_super____________01',
    tenantId: null,
    vesselId: null,
    username: 'Ziad',
    email: 'REDACTED@example.com',
    password: 'REDACTED',
    role: 'SUPER_ADMIN',
  },
  {
    id: 'usr_abdallah______________01',
    tenantId: TENANT_ID,
    vesselId: VESSEL_ID,
    username: 'abdallah',
    email: 'REDACTED@example.com',
    password: 'REDACTED',
    role: 'TENANT_ADMIN',
  },
  {
    id: 'usr_zyad__________________01',
    tenantId: TENANT_ID,
    vesselId: VESSEL_ID,
    username: 'zyad',
    email: 'REDACTED@example.com',
    password: 'REDACTED',
    role: 'TENANT_ADMIN',
  },
];

const insertUser = db.prepare(
  `INSERT INTO users (id, tenant_id, vessel_id, username, email, password_hash, role, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

const hashes = await Promise.all(seedUsers.map((u) => bcrypt.hash(u.password, 12)));

db.transaction(() => {
  db.prepare(`INSERT INTO tenants (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(
    TENANT_ID,
    'Arab Bridge Maritime',
    now,
    now,
  );

  db.prepare(
    `INSERT INTO vessels (id, tenant_id, name, imo_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(VESSEL_ID, TENANT_ID, 'UR', '9372688', now, now);

  seedUsers.forEach((u, i) => {
    insertUser.run(u.id, u.tenantId, u.vesselId, u.username, u.email, hashes[i], u.role, now, now);
  });
})();

const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
db.pragma('wal_checkpoint(TRUNCATE)');
db.close();

console.log(`[seed-demo-db] seeded ${count} users in ${SEED_DB}`);
console.log(
  '[seed-demo-db]   Ziad     (REDACTED@example.com)  / REDACTED   SUPER_ADMIN (no tenant)',
);
console.log(
  '[seed-demo-db]   abdallah (REDACTED@example.com)         / REDACTED      TENANT_ADMIN (ABM)',
);
console.log(
  '[seed-demo-db]   zyad     (REDACTED@example.com)      / REDACTED      TENANT_ADMIN (ABM)',
);
