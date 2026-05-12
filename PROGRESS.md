# PROGRESS.md — Progress log + next action

> **This file is read at the start of every session, after REFERENCE.md.** Append to §15 after every task; update §16 immediately after.

---

## 15. Progress Log

> Most-recent first. Format: `### YYYY-MM-DD — <task> — <summary>` then bullets.

### 2026-05-12 — P1-3b — desktop-vessel Electron shell

| Item                                           | Detail                                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop-vessel/`                         | Electron 30 shell: `src/main/index.ts` (BrowserWindow + lifecycle), `child.ts` (spawns api-vessel via `ELECTRON_RUN_AS_NODE`), `server.ts` (local HTTP server: serves SPA + proxies `/api/*` to api-vessel)   |
| Dev mode                                       | `!app.isPackaged` → loads Vite dev URL (`http://localhost:5173`); assumes api-vessel + web-shore running externally via `pnpm dev:vessel`                                                                     |
| Prod mode                                      | Spawns api-vessel from `resources/api-vessel/dist/main.js`; creates local HTTP server on random port; BrowserWindow loads `http://127.0.0.1:<port>`                                                           |
| electron-builder                               | `electron-builder.yml` — Windows NSIS + Linux AppImage + macOS DMG; bundles api-vessel dist + web-shore dist as extraResources                                                                                |
| `electron@30.5.1` / `electron-builder@24.13.3` | Added to `apps/desktop-vessel/devDependencies`; `"electron"` added to root `pnpm.onlyBuiltDependencies`                                                                                                       |
| `.gitignore`                                   | Uncommented `release/`, `*.exe`, `*.msi`, `*.dmg`, `*.AppImage`                                                                                                                                               |
| Root scripts                                   | Added `dev:desktop`                                                                                                                                                                                           |
| **Pre-existing fix**                           | `apps/web-shore`: react-router-dom v6 + TypeScript 5.9 JSX type incompatibility — fixed via `src/react-router-compat.d.ts` module augmentation + pinned `@types/react ~18.2.79` / `@types/react-dom ~18.2.25` |
| CI                                             | `pnpm run ci:full` → 120 ✓ tests, lint clean, typecheck clean, format clean                                                                                                                                   |

**Dev workflow:**

1. Terminal 1: `pnpm run dev:vessel` (starts api-vessel on :3001 + web-shore Vite on :5173)
2. Terminal 2: `pnpm run dev:desktop` (compiles TS + opens Electron window loading :5173)

**Follow-ups (not blocking P1-4):**

- `api-vessel`: add `app.enableShutdownHooks()` + WAL checkpoint `OnApplicationShutdown`
- CI: add `ELECTRON_SKIP_BINARY_DOWNLOAD=1` env var to GitHub Actions if binary download causes CI slowness
- Production packaging: api-vessel has deep NestJS deps — consider `pkg` or `node-sea` bundling

### 2026-05-12 — P1-3a — ui-kit + web-shore (commit `3a9ef1e`)

| Item              | Detail                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/ui-kit` | Button, Badge, BadgeColor, Modal, Spinner, Input, TextArea, AppShell — source-only React+Tailwind package |
| `apps/web-shore`  | Vite 5 + React 18 SPA: login → component tree → job list → sign-off modal with photo upload               |
| API client        | Thin fetch wrapper with JWT injection + 401 redirect                                                      |
| AuthContext       | JWT decode → tenantId/vesselId/email in localStorage                                                      |
| Root tsconfig     | Excludes `packages/ui-kit` (JSX handled by package tsconfig + `typecheck:all -r`)                         |
| New deps          | `react-router-dom@6.x`, `@vitejs/plugin-react@4.x` (added to REFERENCE.md §3)                             |
| CI                | `pnpm run ci:full` → 120 ✓ tests, lint clean, format clean                                                |

**Pending (P1-3b):** `apps/desktop-vessel` — Electron 30 shell embedding the web-shore build + spawning `api-vessel` as a child process.

### 2026-05-12 — Phase 1 — P1-1 + P1-2 (Maintenance schema → API)

| Task                     | PR     | Key output                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-1 PMS schema          | PR #12 | 6 models on both apps (Component/MasterComponent/Job/JobInstance/JobHistory/RunningHourReading) + 3 enums; sync-aware (`hlc/deletedAt`). Shore RLS `*_tenant_isolation` policies + CHECK `jobs_interval_required_chk` + plpgsql trigger `job_histories_immutable`. Vessel mirrors with SQLite `RAISE(ABORT)` trigger. `parent_id` soft FK on vessel only. +10 e2e                                                                         |
| P1-2a sync recorder      | PR #13 | `HlcClockRegistry` + `OutboxRecorder` — tx-aware writer: mints HLC, appends outbox row, merges sync_records via per-field LWW inside the caller's tx. Shared HLC state between gateway/client and recorder. **Closes the P0-9 follow-up.** +12 e2e                                                                                                                                                                                        |
| P1-2b shore CRUD + auth  | PR #14 | `JwtAuthGuard` (RS256, `type=access`) + `@AuthCtx()` decorator + `requireVesselId`. AuthModule `@Global`. Migrated `/tenants/:tenantId/{vessels,users}` → `/{vessels,users}`. `POST /tenants` atomically creates tenant + initial `TENANT_ADMIN`. Six maintenance modules; full CRUD via OutboxRecorder; MasterComponent shore-only; JobHistory read-only. RunningHourReading enforces monotonic value + bumps Component counter. +14 e2e |
| P1-2c vessel CRUD + auth | PR #15 | Mirror on Drizzle/SQLite. Vessel guard accepts both shore RS256 AND vessel-local HS256 (`iss=fleetops-vessel`). MasterComponent + JobHistory read-only. Decimal comparison via `Number()` (SQLite TEXT). +13 e2e                                                                                                                                                                                                                          |
| P1-2d sign-off + photos  | PR #16 | `POST /job-instances/:id/sign-off` on both apps (multipart `photos[]` + form fields). `StorageService` wraps `@aws-sdk/client-s3` (`@Global`; tests `.overrideProvider`). Flow: photos → S3, then atomic tx INSERT JobHistory + UPDATE JobInstance.status=DONE via OutboxRecorder. Vessel service deserializes TEXT-stored JSON cols. +10 e2e                                                                                             |

**New deps:** `@aws-sdk/client-s3@^3.1044` + `@types/multer` (both apps); `ulidx@2.4.1` on api-vessel.

**Verify (PR #16 tip):** shore test:e2e → 55 ✓; vessel test:e2e → 44 ✓; `pnpm -w run ci:full` → 120 ✓; soak both phases PASS.

---

### 2026-05-05 / 2026-05-06 — Phase 0 — P0-6 through P0-10

| Task                   | PR        | Key output                                                                                                                                                       |
| ---------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-6 sync-engine       | PR #4     | `packages/sync-engine/` (engine, in-memory adapter, outbox, LWW, PN-Counter); ADR 0001; `scripts/sync-soak-test.ts`; `tsx`, `fast-check`                         |
| P0-7 api-shore         | PR #6     | NestJS 11 + Prisma 7 + Postgres 16 (Docker **5433**); `Tenant/Vessel/User` with RLS; `withTenant()`; bcrypt 12-round                                             |
| P0-8 api-vessel        | PR #7     | NestJS + Drizzle + better-sqlite3; surface mirrored to SQLite; `MIGRATIONS_DIR` for Electron; dual-mode `packages/domain`                                        |
| P0-9 sync wire         | PR #8+#10 | Bidi gRPC stream; HLC/outbox/sync_records on both sides; `SyncGatewayService` + `SyncClientService`; ADR 0002; soak Phase 2 PASS                                 |
| P0-10 RS256 JWT + OIDC | PR #11    | RS256 keypair; shore signs access (24h) + refresh (30d); vessel offline-verifies; tests reject HS256 confusion/replay/expiry; `typecheck:all` added to `ci:full` |

---

### 2026-05-01 — Phase 0 — P0-1 through P0-5

| Task                      | PR                  | Key output                                                                                                 |
| ------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| P0-1 init monorepo        | `d02edee`           | `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `.gitattributes`                                            |
| P0-2 tooling              | `5381cdb`           | `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json`, `vitest.config.ts`                          |
| P0-3 CI                   | `a62635f`+`91c4015` | `.github/workflows/ci.yml`; branch ruleset on main                                                         |
| P0-4 shared-types + proto | PR #2               | `packages/shared-types/`, `packages/proto/sync.proto`, `packages/flutter-shared/`, `scripts/proto-gen.mjs` |
| P0-5 domain skeleton      | PR #3               | `packages/domain/` — errors, ULID, HLC, quantity; 52 tests ≥95% coverage; ESLint domain-purity rule        |

**Local tooling (Windows):** Node 24.15.0, pnpm 10.33.2, gh 2.92.0, protoc 34.1, Dart 3.11.5, Docker Desktop.

---

## 16. Next Action

> Single, unambiguous next task for any fresh Claude Code session. Update this immediately when a task completes.

**P1-3b done.** Next: **P1-4 — Running-hour scheduling logic** — interval-based job triggering with property-based tests (`fast-check`). Domain: `packages/domain` + pure `RunningHourScheduler` that opens `JobInstance` when `component.running_hours ≥ job.interval_hours`. API: `POST /running-hour-readings` already exists; scheduler hooks into the reading service. Tests cover boundary conditions, monotonicity, and fuzz scenarios.

**Outstanding follow-up tickets (deferred, not blocking P1-4):**

- **P0-10 follow-up: real OIDC.** Add `openid-client@5.x`, implement `OidcService.beginLogin/completeLogin` for Microsoft Entra.
- **P0-10 follow-up: cross-app offline-token e2e.** Boot both apps in one test, login via shore, deliver token via sync, verify offline, write, sync back.
- **P1-2 follow-up: photo-byte sync vessel↔shore.** Only S3 keys traverse the wire today. Deferred to P5.
- **P1-2 follow-up: master library replication shore→vessel.** Vessel `master_components` is read-only and empty until a broadcast mechanism lands.
- **P1-3b follow-up: api-vessel WAL checkpoint.** Add `app.enableShutdownHooks()` + `OnApplicationShutdown` with `PRAGMA wal_checkpoint(TRUNCATE)`.
- **P1-3b follow-up: CI Electron binary.** Add `ELECTRON_SKIP_BINARY_DOWNLOAD=1` to `.github/workflows/ci.yml` if binary download slows CI.
