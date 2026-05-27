# production_readiness_plan.md

Handoff for the next session — derived from a 5-axis production audit run
2026-05-26 (security, deployment, compliance, test coverage,
TODO/functional gaps). The full audit report is not preserved; this
plan is the actionable distillation.

**Bottom line:** the codebase is functionally rich and well-tested in
breadth, but ships with several deployment-stoppers and
security-stoppers that no maritime customer would sign off on. Plan
below is ~5–8 engineering-weeks to paid-pilot-ready.

---

## STATUS as of 2026-05-27

Most blockers + over half the H-tier are shipped. Section headings
below are prepended with **✓** when closed, with the merging PR in
parens. Items without a checkmark are still open.

**Closed (16 / 28 numbered items):**

| Tier         | Closed                                                   |
| ------------ | -------------------------------------------------------- |
| **Blockers** | B1, B2, B3, B4, B5, B6, B7, B8, B11 — only B9 + B10 left |
| **High**     | H1, H2, H3, H4, H5, H8, H9, H10, H14                     |
| **Medium**   | M1                                                       |

**Open (12 numbered items):**

| Tier         | Open    | Notes                                                             |
| ------------ | ------- | ----------------------------------------------------------------- |
| **Blockers** | B9, B10 | Deployment readiness — deferred by Ziad's "everything else first" |
| **High**     | H6      | Needs Ziad's EV cert purchase (~$300/yr)                          |
| **High**     | H7      | ~40h mechanical test coverage backfill                            |
| **High**     | H11     | ISO 27001 docs — mostly writing + business decisions              |
| **High**     | H12     | Mobile non-EN locale keys — translator work, not code             |
| **High**     | H13     | Mobile widget tests — ~24h Flutter                                |
| **High**     | H15     | Mobile QR pairing UX — ~1d                                        |
| **Medium**   | M2–M8   | Cleanup before GA, not pilot — small UX gaps + flaky perf assert  |

**Next recommended pick for the new session:** start with H13 (mobile
widget tests) if you want shippable mobile improvement, OR H7 (untested
controllers) if you want defence depth on the API surface. H11 is
useful only after you've made the policy decisions it requires.

**Closed PRs for reference:** #55 (Week 1 hardening), #56 (super-admin
profile RLS fix), #57 (B5 steps 2+3), #58 (B1 mTLS), #59 (B8), #60
(B6+B7), #61 (H5), #62 (H10), #63 (H8), #64 (H3+H4), #65 (H14), #66
(H9).

---

## 0. Read first

- Branch state on entry: `main` (in sync with `origin/main` at
  `2086c39` or later). No open PRs.
- Each numbered item below is **independent** — pick any order, but the
  weekly grouping at the bottom gives the recommended sequence.
- Verification command after every shore change:
  `pnpm -w run ci:full && pnpm --filter api-shore run test:e2e`
- Verification after every vessel change:
  `pnpm -w run ci:full && pnpm --filter api-vessel run test:e2e`
- One known-flaky test on this machine — `budget-fleetview.e2e.ts`
  warm-path budget asserts <50 ms, real measure ~70 ms on cold cache.
  CI clean container hits the threshold. Ignore unless it's >100 ms.
- Per item: **what / where / fix / verify**. File:line refs are
  exact; copy them into your editor's "Go to file:line".

---

## BLOCKERS (must close before any prod install)

### ✓ B1. gRPC sync is plaintext — closed via #58

**Where:** `packages/sync-engine/src/transport/grpc-transport.ts:222, 396`

Both ends use `grpc.credentials.createInsecure()` / `grpc.ServerCredentials.createInsecure()` unconditionally. Bearer auth token, CRDT deltas, BlobService payloads all travel in clear. Over a vessel's VSAT → public Internet → shore path this is unacceptable.

**Fix:**

```ts
// Read TLS material from env; require it in production
const ca = process.env['SYNC_TLS_CA_PATH']
  ? fs.readFileSync(process.env['SYNC_TLS_CA_PATH'])
  : null;
const cert = process.env['SYNC_TLS_CERT_PATH']
  ? fs.readFileSync(process.env['SYNC_TLS_CERT_PATH'])
  : null;
const key = process.env['SYNC_TLS_KEY_PATH']
  ? fs.readFileSync(process.env['SYNC_TLS_KEY_PATH'])
  : null;

if (process.env['NODE_ENV'] === 'production' && (!ca || !cert || !key)) {
  throw new Error('SYNC_TLS_{CA,CERT,KEY}_PATH required in production');
}

const clientCreds =
  cert && key && ca ? grpc.credentials.createSsl(ca, key, cert) : grpc.credentials.createInsecure();
const serverCreds =
  cert && key && ca
    ? grpc.ServerCredentials.createSsl(ca, [{ private_key: key, cert_chain: cert }], true)
    : grpc.ServerCredentials.createInsecure();
```

Document the 3 env vars in `.env.example` for both shore and vessel.

**Verify:** unit test that boots a server with TLS + client with TLS, plus an integration test that an `Insecure` client cannot connect to a TLS server.

---

### ✓ B2. Vessel JWT secret has hardcoded fallback — closed via #55

**Where:**

- `apps/api-vessel/src/auth/jwt-auth.guard.ts:97`
- `apps/api-vessel/src/auth/auth.service.ts:160`

Both files default to `'vessel-local-dev-secret-change-me'` if `VESSEL_LOCAL_JWT_SECRET` is unset. Anyone with the source can forge tokens with any `tenantId`/`vesselId`/`role`.

**Fix:** strip both fallbacks, throw at module init:

```ts
// In a new apps/api-vessel/src/config/secrets.ts or similar
export function requireVesselJwtSecret(): string {
  const s = process.env['VESSEL_LOCAL_JWT_SECRET'];
  if (!s || s === 'vessel-local-dev-secret-change-me' || s.length < 32) {
    throw new Error('VESSEL_LOCAL_JWT_SECRET must be set to a strong value (>=32 chars)');
  }
  return s;
}
```

Then import + call it in both files instead of the inline default.

**Verify:** boot the vessel API with the env var unset → process exits non-zero with the message. Add a unit test.

---

### ✓ B3. `POST /tenants` is unauthenticated — closed via #55

**Where:** `apps/api-shore/src/tenant/tenant.controller.ts:19-22`

Anyone reaching the shore API can create tenants + TENANT_ADMIN users without auth — DoS via storage exhaustion + trivial account-creation attack.

**Fix:**

```ts
import { JwtAuthGuard, requireRole } from '../auth/jwt-auth.guard.js';

@Post()
@UseGuards(JwtAuthGuard, requireRole('SUPER_ADMIN'))
async create(@Body() dto: CreateTenantDto) { … }
```

For first-tenant bootstrap, keep `POST /auth/bootstrap-super-admin` (already key-gated). It creates the super-admin, who then creates the first tenant via this newly-guarded endpoint.

**Verify:** existing tenant-create e2e tests must be updated to pass a super-admin token. Add a test that asserts 401 without a token and 403 with a TENANT_ADMIN token.

---

### ✓ B4. OIDC `clientSecret` leaks via `GET /auth/oidc/configs` — closed via #55

**Where:**

- `apps/api-shore/src/auth/oidc.service.ts:132-140` (`getConfigs`)
- `apps/api-shore/src/auth/oidc.controller.ts:57-60` (only `JwtAuthGuard`, no role check)

Any authenticated user — including CREW — calls `GET /auth/oidc/configs` and gets `TenantSsoConfig.clientSecret` in the response.

**Fix:** two changes:

1. Gate the endpoint:
   ```ts
   @UseGuards(JwtAuthGuard, requireRole('TENANT_ADMIN', 'SUPER_ADMIN'))
   ```
2. Project the secret out of the service response:
   ```ts
   const configs = await tx.tenantSsoConfig.findMany({ where: { tenantId } });
   return configs.map(({ clientSecret, ...rest }) => ({
     ...rest,
     hasSecret: Boolean(clientSecret),
   }));
   ```

**Verify:** e2e test asserting (a) CREW gets 403, (b) TENANT_ADMIN response has `hasSecret: true` and **no** `clientSecret` key.

---

### ✓ B5. Real credentials hardcoded in committed smoke-test scripts — closed: step 1 (rotate) done by Ziad via UI; steps 2+3 (env vars + CI grep guard) in #57; step 4 (`git filter-repo` history rewrite) done out-of-band

**Where:**

- `scripts/smoke-test-3-usernames.mjs:16-22` — `Ziad/REDACTED`
- `scripts/smoke-test-web.mjs:175` — same
- `scripts/seed-vessel-from-shore.mjs:9` — `abdallah/REDACTED`, `zyad/REDACTED`
- Real-looking emails: `REDACTED@example.com`, `REDACTED@example.com`, `REDACTED@example.com`

**Fix steps (in order):**

1. **Rotate every one of these passwords** in the live dev DB and any tenant admin who actually uses them (Ziad, abdallah, zyad).
2. Replace the literals with `process.env['SMOKE_PASSWORD']` + similar for emails. Bail loudly if unset.
3. Add a CI grep guard at the lint step:
   ```bash
   if grep -rn "REDACTED\|REDACTED\|REDACTED" scripts/ apps/ packages/; then
     echo "ERROR: known leaked passwords present"; exit 1
   fi
   ```
4. **Rewrite git history** to scrub the passwords (`git filter-repo` or BFG) — note this rewrites every PR ref. Coordinate with anyone who has the repo checked out.

**Verify:** the grep guard runs in CI; `git log -p --all | grep REDACTED` returns nothing.

---

### ✓ B6. Sync proto has no `actorUserId` — class-society audit blocker — closed via #60 (wire layer; per-service plumbing of real `req.user.id` into the 45 vessel call sites is a deferred follow-up — 'system' is the current default)

**Where:**

- `packages/proto/sync.proto` — `SyncRecord` carries `entityType, entityId, hlc, payload`, no actor
- `apps/api-vessel/src/sync/outbox-recorder.ts` — outbox row mirrors that shape

Shore receives a vessel uplink and cannot answer "which crew member made this change?" Class-society audit (DNV CG-0339, ISO 27001 A.8.15) requires it.

**Fix:** additive proto change, no breaking-wire risk if vessel sends `actorUserId` and shore reads it when present:

```proto
message SyncRecord {
  // existing fields …
  string actor_user_id = 7;  // ULID of the user who triggered the change
}
```

Then:

1. Regenerate proto (`pnpm proto:gen`).
2. Add `actorUserId` column to vessel `sync_outbox` and shore `sync_records` (Drizzle + Prisma migrations).
3. Plumb `req.user.id` into every `outboxRecorder.record(…)` call site.
4. On shore apply, emit `AuditEvent` with `actorUserId` populated (see B7).
5. Backfill existing rows: `UPDATE … SET actor_user_id = 'system'` for the gap.

**Verify:** new e2e test that creates a record on vessel, syncs, then asserts the shore `AuditEvent` row has the original creator's user_id.

---

### ✓ B7. `AuditEvent` records only `JOB_SIGNED_OFF` — full audit coverage missing — closed via #60

**Where:** the only `audit.record` call across `apps/api-shore/src/` is `apps/api-shore/src/job-history/job-history.service.ts:356`. Every other mutation — login, logout, PATCH on any entity, DELETE, role change, SSO callback, tenant create — generates **zero** `AuditEvent` rows. ISO 27001 A.8.15 + class-society blocker.

**Fix:**

1. New NestJS global interceptor `AuditInterceptor` in `apps/api-shore/src/audit/audit.interceptor.ts`:
   - Records all `POST` / `PATCH` / `DELETE` requests after success.
   - Extracts `actorUserId` from `req.user.id`, route path, response status, optional diff.
2. Register globally in `app.module.ts` via `APP_INTERCEPTOR`.
3. Explicit `audit.record` calls in `AuthService.login` / `logout` / refresh-token rotate.
4. Explicit calls in `OidcService.completeLogin` for SSO logins.
5. Vessel side: shore's existing `applyRemoteDelta` should `audit.record` once per applied row with `actorUserId` from B6's proto field.

Add an admin-only `GET /audit-events?actor=…&entity=…&from=…` endpoint with the same RLS filter the model already enforces.

**Verify:** e2e that exercises one of every mutation type (login, create cert, patch cert, delete cert, vessel sync upload) and asserts the corresponding `AuditEvent` row exists.

---

### ✓ B8. Immutability trigger doesn't cover DELETE — closed via #59

**Where:** `apps/api-shore/prisma/migrations/20260506173034_add_maintenance_schema/migration.sql:272-298` — trigger is `BEFORE UPDATE` only. e2e `apps/api-shore/test/audit-events.e2e.ts:148-165` asserts UPDATE rejection but **not** DELETE rejection.

**Fix:** new migration `add_job_history_delete_immutability`:

```sql
CREATE OR REPLACE FUNCTION job_histories_delete_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'job_histories rows are immutable (DNV CG-0339)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_histories_no_delete
  BEFORE DELETE ON job_histories
  FOR EACH ROW EXECUTE FUNCTION job_histories_delete_immutable();
```

**Verify:** extend the existing e2e to also attempt `DELETE` and assert it returns an error.

---

### B9. Zero Dockerfiles, no health endpoints, no observability

**Where:** absence — grep `**/Dockerfile*` matches only `node_modules/bcrypt`; no `/health` or `/healthz` route in either API; zero `sentry`/`otel`/`datadog`/`prom-client` deps anywhere.

**Fix (large; split into 4 PRs):**

1. **Dockerfiles:**
   - `apps/api-shore/Dockerfile` — multi-stage Node 24 + Prisma client gen + `dist/`
   - `apps/api-vessel/Dockerfile` — only if vessel runs containerised (not always; Electron bundle is the default)
   - `apps/web-shore/Dockerfile` — nginx-alpine serving Vite build
   - `infra/docker-compose.prod.yml` — Postgres 16 + shore + web; no Superset/MinIO/Meilisearch by default
2. **Health endpoints:**
   - `@nestjs/terminus` with `PrismaHealthIndicator` on shore, `DrizzleHealthIndicator` on vessel
   - `GET /healthz` (liveness) + `GET /readyz` (DB ping)
3. **Logging:** `apps/api-shore/src/app.module.ts:79` pino already JSONs in production. Add `transport: undefined` explicit, redact `authorization` (already done), redact `req.body.password` and `req.body.identifier`.
4. **Telemetry:** add `@sentry/nestjs` for error reporting; OpenTelemetry SDK for trace export to whatever collector the chosen hosting target (B-blocker: §17 unanswered) provides. Add `/metrics` endpoint via `nestjs-prometheus`.

**Verify:** `docker compose -f infra/docker-compose.prod.yml up --build` boots clean; `curl localhost:3000/healthz` returns 200; trigger an unhandled error in dev and confirm it appears in Sentry.

---

### B10. Production seed script leaks demo creds

**Where:** `scripts/seed.ts` hardcodes `admin@demo.local / Admin1234!`, `master@demo.local / Master1234!`, `chief@demo.local / Chief1234!`, "Demo Shipping Co." tenant. **`apps/docs/runbooks/pilot-deploy.md` §5.3 instructs operators to run `pnpm run seed` in production**.

**Fix:**

1. Rename `scripts/seed.ts` → `scripts/seed-dev.ts`. `package.json`: `"seed:dev"`.
2. New `scripts/seed-prod.ts` that:
   - Refuses to run unless `NODE_ENV === 'production'` AND `--confirm-prod` flag passed
   - Prompts interactively for super-admin email + password (or reads from stdin)
   - Creates only that one super-admin row; no demo tenant, no demo users
3. Update `apps/docs/runbooks/pilot-deploy.md` §5.3 to call `seed:prod`.

**Verify:** running `seed:prod` in dev mode errors out; running it in prod mode prompts interactively.

---

### ✓ B11. Vessel SQLite missing WAL checkpoint on shutdown — closed via #55

**Where:** `apps/api-vessel/src/main.ts` — no `app.enableShutdownHooks()`, no `OnApplicationShutdown` calling `PRAGMA wal_checkpoint(TRUNCATE)`. Abrupt power loss (very common on vessels) → potential corruption of unsynced WAL frames.

Flagged in PROGRESS.md §16 as a P1-3b follow-up — never closed. 10-minute fix.

**Fix:**

```ts
// apps/api-vessel/src/main.ts (in bootstrap, after app.create)
app.enableShutdownHooks();

// apps/api-vessel/src/db/drizzle.service.ts (add OnApplicationShutdown)
async onApplicationShutdown() {
  try {
    this.db.run(sql`PRAGMA wal_checkpoint(TRUNCATE)`);
  } catch (e) {
    this.logger.error('WAL checkpoint failed on shutdown', e);
  }
}
```

**Verify:** stop vessel API, run `sqlite3 vessel.db 'PRAGMA wal_checkpoint(PASSIVE)'`, assert it reports `0 0 0` (already truncated).

---

## HIGH (block customer acceptance test, not install)

### ✓ H1. nodemailer CVE-2025-14874 (DoS via addressparser) — closed via #55

**Where:** transitive `nodemailer@6.10.1` via `packages/sync-engine`. Single malicious email-style address crashes the process.

**Fix:** `pnpm -w up nodemailer@^7.0.11` (or `^8.0.5` to also clear GHSA-c7w3-x93f-qmm8 and GHSA-vvjj-xcjg-gr5g). Re-run `pnpm audit --prod`.

### ✓ H2. No fail-loud env validation on prod boot — closed via #55

**Where:** `apps/api-shore/src/main.ts`, `apps/api-vessel/src/main.ts`, `apps/api-shore/src/storage/storage.module.ts:23-24` (S3 keys silently empty).

**Fix:** `assertProductionEnv()` called from `bootstrap()`:

```ts
function assertProductionEnv() {
  if (process.env['NODE_ENV'] !== 'production') return;
  const required = [
    'DATABASE_URL',
    'JWT_PRIVATE_KEY_PATH',
    'JWT_PUBLIC_KEY_PATH',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_BUCKET',
    'PLATFORM_BOOTSTRAP_KEY', // empty allowed but should be set to disable
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing prod env: ${missing.join(', ')}`);
  // Also detect dev defaults that shouldn't be in prod:
  const dangerousDevDefaults = {
    PLATFORM_BOOTSTRAP_KEY: 'dev',
    VESSEL_LOCAL_JWT_SECRET: 'vessel-local-dev-secret-change-me',
  };
  for (const [k, dev] of Object.entries(dangerousDevDefaults)) {
    if (process.env[k] === dev) throw new Error(`${k} is set to the dev default value`);
  }
}
```

### ✓ H3. No CORS configuration on shore — closed via #64

**Where:** `apps/api-shore/src/main.ts` has no `app.enableCors()`.

**Fix:**

```ts
app.enableCors({
  origin: process.env['CORS_ORIGINS']?.split(',') ?? [],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});
```

Document `CORS_ORIGINS` in `.env.example` (comma-separated list of allowed origins, e.g. `https://app.fleetops.com`).

### ✓ H4. Vessel API missing helmet + login rate-limit — closed via #64

**Where:** `apps/api-vessel/src/main.ts` no helmet; `apps/api-vessel/src/app.module.ts` no `ThrottlerModule`.

**Fix:** mirror shore (`apps/api-shore/src/main.ts` for helmet + `apps/api-shore/src/auth/auth.module.ts` for throttler config). Same 10/minute on `/auth/login`. Defense-in-depth even though vessel is loopback by intent.

### ✓ H5. Refresh tokens stateless + never revokable — closed via #61

**Where:** `apps/api-shore/src/auth/auth.service.ts:66-88`. A leaked 30-day refresh token cannot be invalidated short of rotating `JWT_PRIVATE_KEY_PATH` (logs everyone out).

**Fix:**

1. New table `refresh_token_jti_denylist (jti varchar(26) primary key, expires_at timestamptz, revoked_at timestamptz default now())` — Prisma migration.
2. On every `/auth/refresh`: check `jti` not in denylist; on success, insert old `jti` into denylist (rotate-on-use).
3. Detect refresh-token reuse: if a `jti` is presented again after being rotated → revoke entire user session (insert all that user's outstanding `jti`s).
4. New admin endpoint `POST /auth/sessions/:userId/revoke` for emergency logout.
5. Reduce access token TTL from 24 h → 15 min (`JWT_ACCESS_TTL_MS=900000`) now that rotation works.
6. Add throttler to `/auth/refresh` (e.g. 30/min).

### H6. Electron installer unsigned + no auto-updater

**Where:** `apps/desktop-vessel/electron-builder.yml` — `forceCodeSigning: false`, `signDlls: false`, no `publish:` block. `apps/desktop-vessel/package.json` version `"0.0.0"`.

**Fix:**

1. Procure code-signing cert (DigiCert or similar EV cert ~$300/yr — flag for Ziad in CLAUDE.md §17).
2. Set `forceCodeSigning: true`, configure signing in CI Windows runner via secret env vars.
3. Add `publish: { provider: 'github', repo: 'fleetops', owner: 'D1ckenS' }` and wire `electron-updater` into the renderer process.
4. Bump version to `1.0.0-pilot.0` (semver pre-release) and tag releases.

### H7. 60+80 untested API endpoints (e2e coverage holes)

**Where (shore):** condition-of-class, discharge-log, drybms-element, inspection, jha, management-review, part-category, qhse-objective, rest-hour-entry, safety-equipment, survey, voyage-leg — 12 controllers × ~5 endpoints = 60.

**Where (vessel):** same 12 + audit-finding, project, quote, rfq — 16 controllers, ~80 endpoints.

**Fix:** boilerplate test per controller — CRUD + RLS isolation check. Pattern is established by existing `apps/api-shore/test/deferred-stub-schemas.e2e.ts` — copy and parametrise per entity. Budget ~1.3 h per file → 16 files × 1.3 h = ~20 h per API.

**Highest-stakes:** `rest-hour-entry` (MLC compliance auditor-facing), `survey` (class-society audit trail), `condition-of-class` (CoC closure procedure auditable).

### ✓ H8. 13 of 16 `tenant-materialisers` untested round-trip — closed via #63

**Where:** `apps/api-vessel/test/tenant-broadcast-sync.e2e.ts` exercises only Jha, DrybmsElement, QhseObjective. The other 13 (MasterComponent, PartCategory, Supplier, ApprovalFlow, ApprovalStep, CertificateType, DrillType, PermitTemplate, ChecklistTemplate, QhseDocument, DocumentRevision, FuelProduct, ManagementReview) are smoke-checked for registry-key existence only.

**Fix:** parametrise the existing Jha test into a table-driven format that iterates all 16 entities. Each iteration: create on shore via real Prisma, force-broadcast, simulate vessel apply via `DrizzleSyncAdapter.applyRemoteDelta`, assert vessel row has the right field values + tenantId.

### ✓ H9. Class-society submission is fire-and-forget — closed via #66

**Where:** `apps/api-shore/src/class-society/class-society.service.ts:81-166`. Status only transitions DRAFT → SUBMITTED|ERROR. No ACCEPTED/REJECTED tracking.

**Fix:**

1. New cron job (`@Cron('0 */6 * * *')`) that polls DNV Veracity / ABS / LR endpoints for status of each `SUBMITTED` row, updates to ACCEPTED/REJECTED with `responseBody`.
2. New webhook receiver `POST /class-society/webhook/:society` for class societies that push status (most do).
3. Add `lastPolledAt`, `polledStatus`, `webhookReceivedAt` columns + Prisma migration.

### ✓ H10. Cert-expiry emails are `EMAIL_STUB` console logs — closed via #62

**Where:** `apps/api-shore/src/certificate/certificate.service.ts:197` — production cert renewal alerts print to console only.

**Fix:** reuse the nodemailer provider from `packages/sync-engine/src/smtp-sync/nodemailer-imap-provider.ts`. Wire SMTP env vars (already documented in PROGRESS.md §15 P5-1). Send templated email when cert is 90/30/7 days from expiry.

### H11. ISO 27001 — 7 PARTIAL controls (drift vs PROGRESS.md "5")

**Where:** `apps/api-shore/src/compliance/compliance.service.ts:382-682`. Controls flagged PARTIAL: A.5.1 (no ISMS policy doc), A.5.34 (no DPIA), A.6.8 (no IR runbook), A.7.8 (hardware placement), A.8.7 (no Dependabot/Snyk), A.8.16 (no SIEM), A.8.29 (no external pen test).

**Fix:** mostly documentation work, ~5 days total:

- A.5.1: write `apps/docs/policies/isms-policy.md` (1 day, template online)
- A.5.34: write `apps/docs/policies/dpia.md` (1 day — list personal data processed: crew names, emails, MLC hours; assess risk)
- A.6.8: write `apps/docs/runbooks/incident-response.md` (half-day — detection, triage, contain, eradicate, recover, post-mortem)
- A.7.8: document hardware-placement requirements in pilot deploy runbook (half-day)
- A.8.7: enable Dependabot in repo settings + `.github/dependabot.yml` (15 min)
- A.8.16: pick SIEM (Sentry already partial; or Datadog logs / Grafana Loki); wire log shipper (1 day)
- A.8.29: book external pen test (1 day prep, then 2-week vendor engagement)

### H12. Mobile: 265 missing locale keys per language for EL/NL/RU/TL/ZH

**Where:** `apps/mobile/assets/locales/{el,nl,ru,tl,zh}.json` — only ~28 keys each vs en.json's 293. Rest fall back to EN at runtime.

**Fix:** translate or get translated. Either:

- Use the same translator workflow as web (the web side has full coverage for these locales — borrow vocabulary)
- Or machine-translate as English-placeholder + flag for translator review (mark with a `__needs_review` suffix or sidecar TODO list)

### H13. Mobile: zero widget tests across 26 screens

**Where:** `apps/mobile/test/` has only 5 test files (`auth_test.dart`, `cert_filters_test.dart`, `jwt_decode_test.dart`, `models_test.dart`, `outbox_service_test.dart`, `request_bodies_test.dart`). All other 26 screens have no behavioural coverage — only `flutter analyze`.

**Fix:** golden + widget tests for the critical-path 8 screens: `login_screen`, `home_screen` tab navigation, `jobs_screen` sign-off flow, `inventory_screen` adjust-stock, `certificates_screen` filter, `po_receive_screen` barcode→GRN, `rest_hours_screen` save flow, `sync_status_badge` retry/discard. Budget ~3 h each = ~24 h.

### ✓ H14. 7 smoke-test scripts orphaned from CI — partially closed via #65 (nightly workflow runs soak:sync + booted-shore smoke; Electron + web SPA smoke still TODO, gated on H6 and Playwright cache setup)

**Where:** `scripts/smoke-test-*.mjs` (electron, bootstrap, web, seeded-login, usernames, flows, spa-username). Run manually, never gated. Electron desktop bundle ships untested per commit.

**Fix:** new `.github/workflows/nightly.yml` that:

- Builds the Electron installer
- Runs the bootstrap + seeded-login smoke tests against it
- Runs `pnpm run soak:sync` (sync soak test)
- Reports to Slack/email on failure

### H15. Mobile `api_client.dart` hardcoded LAN default

**Where:** `apps/mobile/lib/services/api_client.dart:18` — `baseUrl = 'http://localhost:3001'`. Still open from `mobile_fixes.md` §3d.

**Fix:** EITHER drop the default (force user through "Advanced > Vessel API URL" on first launch) OR build a QR-pairing flow (the vessel SPA renders a QR; mobile scans it → URL + tenantId in one go). The QR approach is significantly better UX.

---

## MEDIUM (cleanup before GA, not pilot)

### ✓ M1. Prune PROGRESS.md §16 — closed via #55

6 of 12 outstanding-follow-up bullets are already done. Re-read the list and strikethrough or delete:

- Edit modals for 12 entities (✓ PR #46+#47)
- i18n for 12 Create modals (✓ PR #47)
- CLAUDE.md §24 update (✓ same PR)
- Mobile i18n remaining (✓ PR #50)
- Mobile cert filter (✓ PR #49)
- Mobile offline outbox (✓ PR #51)

### M2. `UpdateJobDto.title` should be required

**Where:** `apps/api-shore/src/job/dto/job.dto.ts` — `@IsOptional() @IsString() title?: string;` but `EditJobModal.tsx:65-92` always sends it. Server accepts empty title.

**Fix:** drop `@IsOptional()` OR add a cross-field validator that requires `title` if other key fields are also being updated. Add e2e asserting empty `title` returns 400.

### M3. 21 web-shore locale keys missing from non-EN files vs EN

**Where:** `apps/web-shore/src/locales/{ar,de,el,nl,ru,tl,zh}.json` — each missing 21 keys present in en.json. Likely recent additions never backfilled.

**Fix:** `jq` script to diff keys, then translate or English-placeholder. ~1 hour.

### M4. Tank model: no Create/Edit modal, `fuelProductId` not editable

**Where:** `apps/web-shore/src/pages/FlgoPage.tsx` displays Tank but no `+ New Tank` button. `Tank.fuelProductId` (schema.prisma:1447) has no UI.

**Fix:** add `CreateTankModal` + `EditTankModal` mirroring the deferred-stub pattern; include a `fuelProductId` Select sourced from `/fuel-products`.

### M5. Survey model: `certificateId` not editable in modal

**Where:** `EditSurveyModal.tsx` and `CreateSurveyModal.tsx` — the field exists in the DTO but neither modal renders it.

**Fix:** add an optional `certificateId` Select sourced from `/certificates?vesselId=…` (filtered to certificates of this vessel).

### M6. MARPOL `compliant: false` is cosmetic only

**Where:** `apps/web-shore/src/pages/QHSEPage.tsx:1235` renders the badge. No alert, no dashboard tile, no `AuditEvent` emission, no IOPP-export ready format.

**Fix:**

1. Emit `AuditEvent action=MARPOL_NON_COMPLIANT_DISCHARGE` from `DischargeLogService.create` when `compliant === false`.
2. Add a dashboard widget on Fleetview showing non-compliant discharge count YTD.
3. Add an IOPP-format CSV export endpoint.

### M7. 2 non-additive migrations risk in-place upgrades

**Where:**

- `apps/api-shore/prisma/migrations/20260518080000_generalize_sso_config/migration.sql` — `DROP COLUMN entra_client_id, entra_tenant_id`; `SET NOT NULL` on multiple cols (with backfill before, so safe)
- `apps/api-shore/prisma/migrations/20260521140000_remove_vessel_id_from_part_categories/migration.sql` — `DROP COLUMN vessel_id` (reverts a same-day mistake; data never live)

Both are fine for fresh installs. For an upgrade on a populated production DB: backup first, run in maintenance window. **Document in upgrade notes** (no code change needed).

### M8. Flaky perf test on slow machines

**Where:** `apps/api-shore/test/budget-fleetview.e2e.ts` warm-path budget asserts <50 ms; this machine measures 74 ms reliably. CI clean Postgres container hits the threshold.

**Fix (optional):** loosen to <100 ms with a comment explaining the warm-path expectation, OR mark `test.runIf(process.env['CI'])` so it only runs in CI.

---

## CLAUDE.md §17 — answers needed from Ziad

These block pilot launch (or specific phases of it):

- [ ] **First pilot vessel.** Customer side. Needed to know offline-window expectations, VSAT bandwidth, hardware specs, training calendar.
- [ ] **Class society.** DNV vs ABS vs LR changes the evidence bundle format and the class-society submission integration to focus on (P4-3 shipped all 6 with stubs).
- [ ] **Hosting target.** Drives the §B9 deployment plan — AWS (ECS + RDS), Azure (ACA + Postgres Flexible), customer on-prem (k8s + helm), customer private cloud.
- [ ] **Accounting integration target.** P4-2 shipped Exact Online + CSV; broader (SAP, NetSuite, Twinfield) deferred until customer asks.
- [ ] **2BA / Nareto licensing.** Direct license (~€10k/yr each) vs skip until a customer brings their own.
- [ ] **Code-signing certificate purchase.** EV cert ~$300/yr for Electron installer (B9 / H6).

---

## Suggested implementation order

### Week 1 — Stop the bleeding

B5 (rotate + scrub passwords), B2 (vessel JWT hard-fail), B3 (gate POST /tenants), B4 (strip OIDC secret), H1 (nodemailer bump), H2 (fail-loud env), B11 (WAL checkpoint), M1 (prune PROGRESS.md).
~3 days.

### Week 2 — Crypto in transit

B1 (gRPC TLS) — env-gated, refuse-to-boot in prod without certs. Includes provisioning a self-signed CA for dev/test + writing a sysadmin doc on cert rotation.
~4 days.

### Week 3 — Audit + immutability

B6 (actorUserId in proto + outbox), B7 (AuditEvent interceptor + login/logout/SSO + vessel apply), B8 (DELETE trigger). Plus H8 (parametrise materialiser tests) since you're already in `tenant-broadcast-sync.e2e.ts`.
~5 days.

### Week 4–5 — P5-5 deployment readiness

B9 (Dockerfiles + health + observability), B10 (seed-prod separation), H3 (CORS), H4 (vessel helmet + throttler), H5 (refresh-token revocation), H6 (Electron signing + auto-updater), H10 (cert-expiry SMTP). Backup scripts + restore drill.
~10 days.

### Week 6 — Test coverage backfill

H7 (12+16 untested controllers, ~16 h each side), H13 (mobile widget tests for 8 critical screens), H14 (nightly smoke workflow).
~5 days.

### Week 7 — Compliance docs + sign-off prep

H11 (ISO 27001 — write 4 docs, enable Dependabot, pick SIEM, book pen test), H9 (class-society lifecycle polling). Answer the open §17 questions with Ziad.
~5 days.

### Week 8 — UX polish + GA prep

H12 (mobile non-EN locale keys), H15 (mobile QR pairing or default removal), M2–M7 (UX gaps). Final dry-run on pilot vessel hardware.
~5 days.

**Total: ~37 working-days = 7–8 weeks.** Two engineers in parallel could compress to ~4–5 weeks if Week 2 (TLS) and Week 4–5 (deployment) split cleanly between backend and infra.

---

## What's already healthy (don't redo)

- RLS on all 75 tenant-scoped Prisma models (verified across 17 migrations)
- Shore JWT signing RS256 + env paths required, hard-fails on missing
- bcrypt cost 12 consistently across shore + vessel
- `.env` / `keys/` correctly gitignored
- Shore `/auth/login` already rate-limited 10/min (P5-4)
- Existing tests are real (not theatre) — sampled 3 e2e files independently
- Sync engine is real CRDT (HLC-based LWW); transport works for blob + delta
- MLC 2006 rest-hour validation is wired into both shore + vessel create paths (only edit bypass is open)
- No skipped/`.only`/`it.todo` anywhere in tests
- i18next + react-i18next + easy_localization scaffolds exist; web has full 8-language coverage for most keys
- 12 deferred-stub entities all have Create + Edit modals with proper i18n (PR #46 + #47)
- Mobile has working offline outbox + barcode→GRN flow (PR #51)
