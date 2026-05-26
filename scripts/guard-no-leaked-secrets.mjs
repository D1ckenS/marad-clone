// CI grep guard (B5 step 3) — fails the build if any of the known-leaked
// credentials reappear under scripts/, apps/, or packages/.
//
// These literals were live in the dev DB before B5 step 1 rotated them.
// They are already public via git history (PR #29 onward) and the audit log.
// Listing them here is fine — the point is to prevent NEW occurrences.
//
// New passwords are NEVER added here; they're protected by the
// env-var-only-access pattern in scripts/_smoke-creds.mjs.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const LEAKED_LITERALS = [
  'REDACTED',
  'REDACTED',
  'REDACTED',
  'REDACTED@example.com',
  'REDACTED@example.com',
  'REDACTED@example.com',
];

const SCAN_DIRS = ['scripts', 'apps', 'packages'];

// Skip generated / vendored / lockfile-style paths. node_modules + dist + build
// would still match leaked literals technically, but they're not source we own.
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'dist-types',
  'build',
  'out',
  '.turbo',
  '.next',
  '.smoke-results',
  'api-vessel-bundle',
  'release',
  'coverage',
]);

const SKIP_FILES = new Set([
  // The guard itself + the audit plan are allowed to mention the literals.
  'guard-no-leaked-secrets.mjs',
]);

const SKIP_SUFFIXES = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.pdf', '.zip', '.db'];

function shouldScanFile(name) {
  if (SKIP_FILES.has(name)) return false;
  for (const sfx of SKIP_SUFFIXES) if (name.endsWith(sfx)) return false;
  return true;
}

const offences = []; // {file, line, col, literal, snippet}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full);
    } else if (st.isFile() && shouldScanFile(entry)) {
      scanFile(full);
    }
  }
}

function scanFile(file) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    return; // binary or unreadable — skip
  }
  for (const literal of LEAKED_LITERALS) {
    let idx = 0;
    while ((idx = content.indexOf(literal, idx)) !== -1) {
      const before = content.slice(0, idx);
      const line = before.split('\n').length;
      const col = idx - before.lastIndexOf('\n');
      const lineStart = before.lastIndexOf('\n') + 1;
      const lineEnd = content.indexOf('\n', idx);
      const snippet = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd).trim();
      offences.push({
        file: path.relative(REPO_ROOT, file),
        line,
        col,
        literal,
        snippet: snippet.slice(0, 120),
      });
      idx += literal.length;
    }
  }
}

for (const d of SCAN_DIRS) walk(path.join(REPO_ROOT, d));

if (offences.length > 0) {
  console.error('\n✗ guard-no-leaked-secrets: found known-leaked credentials in source.\n');
  for (const o of offences) {
    console.error(`  ${o.file}:${o.line}:${o.col}  [${o.literal}]`);
    console.error(`    ${o.snippet}`);
  }
  console.error(
    `\n${offences.length} occurrence(s). These passwords were leaked publicly and must never reappear in tracked source.`,
  );
  console.error(
    'If you genuinely need them as test fixtures, route through scripts/_smoke-creds.mjs + scripts/.env.smoke (gitignored).\n',
  );
  process.exit(1);
}

console.log('✓ guard-no-leaked-secrets: clean');
