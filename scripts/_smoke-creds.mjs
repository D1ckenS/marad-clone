// Shared credential lookup for smoke tests + the demo-db seed script (B5).
//
// Reads SMOKE_* env vars and throws at import time if any are missing —
// smoke tests must fail loudly, not run silently against the wrong user.
//
// Local dev: copy scripts/.env.smoke.example → scripts/.env.smoke and fill
// in the real values. scripts/.env.smoke is gitignored.
//
// CI: set the vars in the workflow's `env:` block from GitHub secrets.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(HERE, '.env.smoke');

// Minimal dotenv loader so smoke tests don't need any extra dep / wrapper.
// Only sets keys that aren't already in process.env (CI / shell wins).
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function requireEnv(name) {
  const v = process.env[name];
  if (v === undefined || v.trim() === '') {
    throw new Error(
      `Missing required env var: ${name}. ` +
        `Populate scripts/.env.smoke (copy scripts/.env.smoke.example).`,
    );
  }
  return v;
}

export const SUPER = Object.freeze({
  username: requireEnv('SMOKE_SUPER_USERNAME'),
  email: requireEnv('SMOKE_SUPER_EMAIL'),
  password: requireEnv('SMOKE_SUPER_PASSWORD'),
});

export const ABM = Object.freeze({
  username: requireEnv('SMOKE_ABM_USERNAME'),
  email: requireEnv('SMOKE_ABM_EMAIL'),
  password: requireEnv('SMOKE_ABM_PASSWORD'),
});

export const ASM = Object.freeze({
  username: requireEnv('SMOKE_ASM_USERNAME'),
  email: requireEnv('SMOKE_ASM_EMAIL'),
  password: requireEnv('SMOKE_ASM_PASSWORD'),
});
