// Builds a portable, electron-ready api-vessel snapshot at
// apps/desktop-vessel/api-vessel-bundle/. Strategy:
//
//   1. Wipe the bundle dir.
//   2. esbuild api-vessel/dist/main.js into a SINGLE main.js inside the bundle,
//      with every JS dep inlined. Only native modules stay external
//      (better-sqlite3). This sidesteps pnpm's symlink mess on Windows.
//   3. Copy better-sqlite3's package + its native binary into bundle/node_modules.
//   4. Rebuild that better-sqlite3 .node against Electron's Node ABI.
//   5. Copy drizzle migrations + JWT public key.
//
// electron-builder.yml ships api-vessel-bundle/ as extraResources.

import { execSync } from 'node:child_process';
import {
  existsSync,
  rmSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_DIR = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(DESKTOP_DIR, '..', '..');
const BUNDLE_DIR = path.join(DESKTOP_DIR, 'api-vessel-bundle');
const API_VESSEL_DIR = path.join(REPO_ROOT, 'apps', 'api-vessel');

const ELECTRON_VERSION = JSON.parse(readFileSync(path.join(DESKTOP_DIR, 'package.json'), 'utf8'))
  .devDependencies.electron;

console.log(`[prepare-bundle] electron version: ${ELECTRON_VERSION}`);

// 1. Wipe previous bundle (Windows-safe).
if (existsSync(BUNDLE_DIR)) {
  console.log(`[prepare-bundle] removing previous bundle at ${BUNDLE_DIR}`);
  if (process.platform === 'win32') {
    try {
      execSync(`cmd /c rmdir /S /Q "${BUNDLE_DIR}"`, { stdio: 'ignore' });
    } catch (_e) {
      rmSync(BUNDLE_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
    }
  } else {
    rmSync(BUNDLE_DIR, { recursive: true, force: true });
  }
}
mkdirSync(path.join(BUNDLE_DIR, 'dist'), { recursive: true });
mkdirSync(path.join(BUNDLE_DIR, 'node_modules'), { recursive: true });

// 2. esbuild api-vessel into a single main.js with all JS deps inlined.
console.log('[prepare-bundle] bundling api-vessel with esbuild…');
await build({
  entryPoints: [path.join(API_VESSEL_DIR, 'dist', 'main.js')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(BUNDLE_DIR, 'dist', 'main.js'),
  // Native modules MUST be external. esbuild can't inline .node files.
  // Optional NestJS peers (websockets/microservices/graphql) are dynamically
  // required at runtime only when used — must stay external for the build.
  external: [
    'better-sqlite3',
    'bcrypt',
    '@mapbox/node-pre-gyp',
    '@nestjs/websockets',
    '@nestjs/websockets/socket-module',
    '@nestjs/microservices',
    '@nestjs/microservices/microservices-module',
    'class-transformer/storage',
    'cache-manager',
    'pg-native',
    // Some packages embed native helpers; mark them external too.
    'sqlite3',
  ],
  // NestJS lazy-loads platform adapters; without these as externals esbuild
  // resolves the optional ones and breaks. Mark them external so they fall
  // through to require() at runtime where they're optional.
  banner: {
    js: [
      '// Suppress NestJS dynamic-require warnings at bundle time.',
      'const __require = require;',
    ].join('\n'),
  },
  logLevel: 'warning',
  // Don't fail on harmless dynamic-require warnings from @nestjs/core, pino, etc.
  logOverride: {
    'unsupported-dynamic-import': 'silent',
    'unsupported-require-call': 'silent',
  },
  sourcemap: false,
  minify: false,
});
console.log('[prepare-bundle] esbuild done');

// 3. Copy the native deps (better-sqlite3, bcrypt) — these CAN'T be inlined.
function copyRealPackage(name) {
  const src = path.join(REPO_ROOT, 'apps', 'api-vessel', 'node_modules', name);
  const dst = path.join(BUNDLE_DIR, 'node_modules', name);
  if (!existsSync(src)) {
    throw new Error(`Native package ${name} not found at ${src}`);
  }
  // Use cpSync with dereference so the symlink chain resolves to real files.
  cpSync(src, dst, { recursive: true, dereference: true });
  console.log(`[prepare-bundle] copied ${name} -> ${dst}`);
}
copyRealPackage('better-sqlite3');
copyRealPackage('bcrypt');

// Runtime deps of the bundled native modules that esbuild can't inline.
// - bindings: better-sqlite3 lib/database.js does `require('bindings')(...)`
// - file-uri-to-path: bindings depends on it
// - node-gyp-build + node-addon-api: bcrypt 6.x uses these to find its .node
const nativeRuntimeDeps = ['bindings', 'file-uri-to-path', 'node-gyp-build', 'node-addon-api'];
for (const d of nativeRuntimeDeps) {
  // Look in pnpm's virtual store since the api-vessel node_modules is symlinked.
  const candidates = [
    path.join(REPO_ROOT, 'apps', 'api-vessel', 'node_modules', d),
    path.join(REPO_ROOT, 'node_modules', d),
  ];
  let src = candidates.find((p) => existsSync(p));
  if (!src) {
    // Search the pnpm virtual store as a fallback.
    const pnpmStore = path.join(REPO_ROOT, 'node_modules', '.pnpm');
    if (existsSync(pnpmStore)) {
      const entries = readdirSync(pnpmStore);
      const match = entries.find((e) => e.startsWith(d.replace('/', '+') + '@'));
      if (match) {
        const candidate = path.join(pnpmStore, match, 'node_modules', d);
        if (existsSync(candidate)) src = candidate;
      }
    }
  }
  if (src) {
    const dst = path.join(BUNDLE_DIR, 'node_modules', d);
    cpSync(src, dst, { recursive: true, dereference: true });
    console.log(`[prepare-bundle] copied ${d} <- ${src}`);
  } else {
    console.warn(`[prepare-bundle] WARN dep ${d} not found — bcrypt may not load at runtime`);
  }
}

// 4. Copy migrations & JWT key
const srcMigrations = path.join(API_VESSEL_DIR, 'drizzle');
const dstMigrations = path.join(BUNDLE_DIR, 'drizzle');
if (existsSync(srcMigrations)) {
  cpSync(srcMigrations, dstMigrations, { recursive: true });
  console.log(`[prepare-bundle] copied migrations`);
}
const srcJwt = path.join(REPO_ROOT, 'keys', 'jwt-public.pem');
const dstJwt = path.join(BUNDLE_DIR, 'jwt-public.pem');
if (existsSync(srcJwt)) {
  copyFileSync(srcJwt, dstJwt);
  console.log(`[prepare-bundle] copied jwt-public.pem`);
} else {
  console.warn(`[prepare-bundle] WARN no jwt-public.pem (shore-issued tokens won't verify)`);
}

// 5. Write a minimal package.json so Node finds dependencies correctly.
writeFileSync(
  path.join(BUNDLE_DIR, 'package.json'),
  JSON.stringify(
    { name: '@fleetops/api-vessel-bundle', version: '0.0.0', main: 'dist/main.js' },
    null,
    2,
  ),
);

// 6. Seed the demo database BEFORE rebuilding better-sqlite3 for Electron —
//    seed-demo-db.mjs runs under plain Node and needs a Node-ABI binary.
console.log('[prepare-bundle] seeding demo database…');
execSync(`node "${path.join(HERE, 'seed-demo-db.mjs')}"`, { stdio: 'inherit', cwd: DESKTOP_DIR });

// 7. Rebuild better-sqlite3 for Electron 30 ABI (must be the copy in BUNDLE_DIR).
console.log(`[prepare-bundle] rebuilding better-sqlite3 for Electron ${ELECTRON_VERSION}...`);
const bsqlitePath = path.join(BUNDLE_DIR, 'node_modules', 'better-sqlite3');
execSync(
  `npx --yes node-gyp rebuild ` +
    `--target=${ELECTRON_VERSION} ` +
    `--dist-url=https://electronjs.org/headers ` +
    `--runtime=electron ` +
    `--arch=${process.arch} ` +
    `--release`,
  { stdio: 'inherit', cwd: bsqlitePath },
);

console.log('[prepare-bundle] done.');
