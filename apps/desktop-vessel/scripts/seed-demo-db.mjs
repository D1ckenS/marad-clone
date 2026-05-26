// Build-time seed: creates a fresh vessel.db pre-populated with a demo
// tenant, vessel, and three login-ready users (one super-admin + two tenant
// admins). Shipped in the installer as extraResources/api-vessel/seed-vessel.db;
// index.ts copies it to userData on first launch when no local vessel.db
// exists yet.
//
// Credentials (B5): read from SMOKE_* env vars when set, otherwise the script
// generates random passwords + a default username/email per user and prints
// the credentials to stdout AND writes them to seed-demo-credentials.txt next
// to the .db file (both in the gitignored api-vessel-bundle/ dir). The three
// roles created are:
//
//   SUPER_ADMIN  (no tenant)        — SMOKE_SUPER_*
//   TENANT_ADMIN (ABM tenant)       — SMOKE_ABM_*
//   TENANT_ADMIN (ASM-like alt user — SMOKE_ASM_*); same ABM tenant for now
//
// No setup wizard, no shore connection required.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
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

// Seed rows. One tenant (ABM), one vessel (UR), three users — including a
// SUPER_ADMIN with no tenant (matches shore design).
const TENANT_ID = '01KQWX2HPGZBJJR9Z8W53SQJM4';
const VESSEL_ID = '01KRTJPG2MZK2HZ78AT6KXEP0Y';
const now = new Date().toISOString();

// Random-password generator for the env-var-unset path. URL-safe, ~16 chars
// of entropy — long enough that a short human-memorable string can't recur
// by accident.
function randomPw() {
  return randomBytes(12).toString('base64url');
}

function resolveCreds(prefix, fallback) {
  const username = process.env[`SMOKE_${prefix}_USERNAME`] ?? fallback.username;
  const email = process.env[`SMOKE_${prefix}_EMAIL`] ?? fallback.email;
  const password = process.env[`SMOKE_${prefix}_PASSWORD`];
  return {
    username,
    email,
    password: password ?? randomPw(),
    generated: password === undefined,
  };
}

const superCreds = resolveCreds('SUPER', {
  username: 'demo-super',
  email: 'demo-super@fleetops.local',
});
const abmCreds = resolveCreds('ABM', {
  username: 'demo-abm',
  email: 'demo-abm@fleetops.local',
});
const asmCreds = resolveCreds('ASM', {
  username: 'demo-asm',
  email: 'demo-asm@fleetops.local',
});

const seedUsers = [
  {
    id: 'usr_demo_super____________01',
    tenantId: null,
    vesselId: null,
    role: 'SUPER_ADMIN',
    ...superCreds,
  },
  {
    id: 'usr_demo_abm______________01',
    tenantId: TENANT_ID,
    vesselId: VESSEL_ID,
    role: 'TENANT_ADMIN',
    ...abmCreds,
  },
  {
    id: 'usr_demo_asm______________01',
    tenantId: TENANT_ID,
    vesselId: VESSEL_ID,
    role: 'TENANT_ADMIN',
    ...asmCreds,
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

// Print credentials and, when any were generated, persist them next to the
// .db so the operator can retrieve them later. The bundle dir is gitignored.
const anyGenerated = seedUsers.some((u) => u.generated);
const lines = [
  `[seed-demo-db] seeded ${count} users in ${SEED_DB}`,
  ...seedUsers.map(
    (u) =>
      `[seed-demo-db]   ${u.role.padEnd(12)} ${u.username} (${u.email}) / ${u.password}${
        u.generated ? '  (generated)' : ''
      }`,
  ),
];
for (const line of lines) console.log(line);

if (anyGenerated) {
  const credsFile = path.join(BUNDLE_DIR, 'seed-demo-credentials.txt');
  const body =
    'Generated seed credentials (gitignored — do not commit this file).\n' +
    'Override by setting SMOKE_{SUPER,ABM,ASM}_{USERNAME,EMAIL,PASSWORD} before re-seeding.\n\n' +
    seedUsers
      .map(
        (u) =>
          `${u.role}\n  username: ${u.username}\n  email:    ${u.email}\n  password: ${u.password}\n`,
      )
      .join('\n');
  writeFileSync(credsFile, body, 'utf8');
  console.log(`[seed-demo-db] wrote generated creds to ${credsFile}`);
  console.log('[seed-demo-db] ⚠  this file is gitignored — keep it out of screenshots / chat');
}
