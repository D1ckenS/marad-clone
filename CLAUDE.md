# CLAUDE.md — MARAD-Equivalent Maritime Fleet Management System

> **For Claude Code.** This file is the single source of truth for the project. It is written so that any fresh Claude Code session can read this file end-to-end and pick up the work without asking the human for context. The human's expected interaction is: "Hey buddy, see this file? Start." — you do the rest.

---

## 0. START HERE — Resume Protocol (read on every fresh session)

Do these five things in order. Do not skip.

1. **Read this entire file.** Every section. Even ones that look like reference. Do not start work until you have.
2. **Run `git status` and `git log --oneline -20`.** Confirm the repo state matches §15 "Progress Log". If it does not, treat the repo as truth and update §15 before doing anything else.
3. **Open §15 "Progress Log"** and find the last completed checkpoint.
4. **Open §16 "Next Action"** — that is your single, unambiguous next task. If §15 and §16 disagree, §15 wins; update §16.
5. **Before starting work**, restate the next action in chat in one sentence so the human can correct you if §16 is stale.

When you finish a task:
- Append a dated entry to §15 "Progress Log" describing what changed and the commit hash.
- Update §16 "Next Action" to the next task from §11 "Build Phases".
- Run the full verification command for the phase you are in (§11 lists it per phase) before claiming done.
- Commit. Use Conventional Commits (§10).

If you ever feel uncertain, prefer **stopping and asking** over guessing. The maritime domain has expensive mistakes.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Project name** | `marad-clone` (working title; replace before launch — see §17) |
| **What** | Hybrid maritime fleet management system: planned maintenance, spare parts inventory, procurement, certificates, crewing, fuel/tank logistics, safety, QHSE. Functional parity with Marad by MaraSoft B.V. (marad.com). |
| **Surfaces** | Onboard desktop (Electron), shoreside web (React), companion mobile (Flutter). |
| **Offline-first** | Vessel installs run with **full feature parity** offline. Sync to shore when connectivity is available. |
| **Compliance targets** | DNV type-approval (PMS), ISO 27001, IMO DCS, EU MRV, MLC 2006. |
| **Success criteria** | (1) Pilot vessel operating exclusively on the system for 90 days with zero data-loss incidents. (2) DNV type-approval certificate issued for the PMS module. (3) Single tenant with 5 vessels in production. |

---

## 2. Locked Decisions (do not relitigate)

The human (Ziad) has already chosen these. Do not propose alternatives unless a hard blocker is found and documented.

- Cross-platform stack: **Electron desktop + Flutter mobile**, both backed by the same Node.js API.
- Deployment: **hybrid** — desktop onboard, web shoreside, mobile companion.
- Scope: **full feature parity** with Marad's published modules.
- Source of truth for "what Marad does": only the public marad.com / marad.cloud / marasoft.nl pages and the Marad brochure linked in §18. **Do not scrape**, do not view screenshots, do not reproduce visuals.
- Languages: TypeScript (backend + web + Electron), Dart (Flutter mobile), SQL.
- Package manager: **pnpm** (monorepo via Turborepo).
- Database: **SQLite on vessel**, **PostgreSQL on shore**.
- Sync transport: **gRPC over HTTP/2** with **SMTP email fallback** for satellite-only vessels.
- Auth: OIDC (Microsoft Entra) for shore + offline-cached JWT for vessel.
- Test runner: **Vitest** (TS) + **flutter_test** (Dart).
- Lint/format: **ESLint + Prettier** (TS), **dart format** + `flutter analyze` (Dart).
- CI: **GitHub Actions**.

---

## 3. Pinned Tech Stack

Pin to these versions. When you bump, update this section in the same commit.

> **Note (2026-05-01):** Versions below are re-verified against upstream at the time each tool is first installed — do not blindly trust an entry until the row's `Installed` column has been confirmed. Several originally-drafted pins were already EOL or superseded by project start (see commit history for §3 changes).

| Layer | Tech | Version |
|---|---|---|
| Node | Node.js | `24.x LTS (Krypton, ≥24.15)` |
| Package mgr | pnpm | `10.x (≥10.33)` |
| Monorepo | Turborepo | `2.x` |
| Backend | NestJS | `11.x (11.1.19)` |
| Backend lang | TypeScript | `5.9+` (hold 5.x; 6.x stabilising) |
| Lint | ESLint + typescript-eslint | `eslint 10.x` + `typescript-eslint 8.59+` (flat config) |
| Format | Prettier | `3.x` |
| ID generation | ulidx | `2.4.1+` (monotonic ULIDs, browser+Node) |
| Web framework | React | `18.x` |
| Web bundler | Vite | `5.x` |
| Web styling | Tailwind CSS | `3.x` |
| Web table | TanStack Table | `8.x` |
| Desktop shell | Electron | `30.x` |
| Desktop builder | electron-builder | `24.x` |
| Mobile | Flutter | `3.22+` (Dart `3.11+`; standalone Dart 3.11.5 installed at P0-4 for protoc-gen-dart, until Flutter SDK lands at P1-11) |
| ORM (shore) | Prisma + `@prisma/client` + `@prisma/adapter-pg` | `7.x (7.8.0)` — config via `prisma.config.ts`; `datasource.url` moved out of schema |
| ORM (vessel) | Drizzle ORM + drizzle-kit + better-sqlite3 | `drizzle-orm 0.45.2` / `drizzle-kit 0.31.10` / `better-sqlite3 12.9.0` |
| Sync RPC | gRPC | `@grpc/grpc-js 1.10+` |
| Sync proto | Protobuf (`protoc 34+`, `ts-proto 2.11+` for TS, `protoc_plugin 25+` for Dart) | `proto3` |
| Postgres | PostgreSQL | `16.x` |
| SQLite | SQLite | `3.45+` (ships with `better-sqlite3`) |
| Search (shore) | Meilisearch | `1.8+` |
| Object store | S3-compatible (MinIO for local dev) | latest |
| Auth | OIDC via `openid-client` | `5.x` |
| Logging | pino + pino-http + nestjs-pino | `10.3.1` / `11.0.0` / `4.6.1` |
| Postgres client | pg + `@prisma/adapter-pg` | `8.20.0` / `7.8.0` |
| Auth (local) | bcrypt + `@nestjs/jwt` + `@nestjs/passport` + passport-local | `6.0.0` / `11.0.2` / `11.0.5` / `1.0.0` |
| Validation | class-validator + class-transformer | `0.15.1` / `0.5.1` |
| HTTP testing | supertest | `7.2.2` |
| Testing | Vitest, Playwright (e2e), flutter_test | `vitest 4.x`, Playwright/flutter_test latest stable |
| Property testing | fast-check | `4.7.0` |
| Script runner | tsx | `4.21.0` |
| BI / dashboards | Apache Superset (later phase) | `4.x` |

**Rule:** If a package is not listed, justify the addition in the commit message and add it here.

---

## 4. Repository Layout

```
marad-clone/
  CLAUDE.md                  ← THIS FILE. Read first every session.
  README.md                  ← Human-facing summary. Short.
  pnpm-workspace.yaml
  turbo.json
  .github/workflows/         ← CI pipelines
  .editorconfig
  .gitignore

  packages/
    shared-types/            ← TS types shared across all surfaces
    proto/                   ← .proto files for sync + API contract
    domain/                  ← Pure-TS domain logic (no IO). Unit tests live here.
    sync-engine/             ← Outbox, HLC clocks, conflict resolution. Used by shore + vessel.
    ui-kit/                  ← Shared React components (used by web + electron)
    flutter-shared/          ← Dart equivalents of shared types (codegen from proto)

  apps/
    api-shore/               ← NestJS backend (multi-tenant Postgres)
    api-vessel/              ← NestJS backend (single-tenant SQLite, runs inside Electron)
    web-shore/               ← Vite + React shoreside SPA
    desktop-vessel/          ← Electron app embedding api-vessel + web-shore build
    mobile/                  ← Flutter app
    docs/                    ← Architecture decision records (ADRs)

  infra/
    docker-compose.dev.yml   ← Local dev (postgres, minio, meilisearch)
    helm/                    ← Production deploy charts
    migrations/              ← Postgres migrations (Prisma)

  scripts/
    bootstrap.sh             ← First-time dev setup
    sync-soak-test.ts        ← 24h offline simulation
```

**Rule:** When you create a new top-level folder or package, add it to this tree in the same commit.

---

## 5. Dev Environment Setup

Run these from the repo root the first time, and any time §3 versions change.

```bash
# 1. Tooling
# Node 24 LTS must be installed system-wide (https://nodejs.org/) — do NOT use Corepack.
npm install -g pnpm@latest            # standalone pnpm (re-verify §3 pin matches latest)
pnpm install                          # installs all workspace deps
flutter pub get -C apps/mobile        # mobile deps
# protoc: download from https://github.com/protocolbuffers/protobuf/releases (Windows)
#   or: brew install protobuf / apt-get install -y protobuf-compiler
# Docker: install Docker Desktop (https://www.docker.com/products/docker-desktop/)

# 2. Local services
docker compose -f infra/docker-compose.dev.yml up -d   # postgres, minio, meilisearch

# 3. Database
pnpm --filter api-shore prisma migrate dev
pnpm --filter api-vessel db:migrate                    # drizzle-kit migrate

# 4. Codegen
pnpm run proto:gen                    # generates TS + Dart from proto/

# 5. Sanity
pnpm run lint && pnpm run typecheck && pnpm run test
```

If `pnpm run lint && pnpm run typecheck && pnpm run test` is green on a fresh clone, the environment is good.

---

## 6. Build / Test / Run Commands (canonical)

These are the only commands you should be running day-to-day. If you find yourself improvising, add the new command here.

| Action | Command |
|---|---|
| Install everything | `pnpm install && flutter pub get -C apps/mobile` |
| Lint | `pnpm run lint` |
| Type-check | `pnpm run typecheck` |
| Unit tests | `pnpm run test` |
| E2E tests (web) | `pnpm --filter web-shore run test:e2e` |
| Mobile tests | `flutter test -C apps/mobile` |
| Sync soak test | `pnpm run soak:sync` |
| Run shore stack (dev) | `pnpm run dev:shore` |
| Run vessel stack (dev) | `pnpm run dev:vessel` |
| Run desktop in dev | `pnpm --filter desktop-vessel run dev` |
| Run mobile (sim) | `flutter run -C apps/mobile` |
| Build desktop installer | `pnpm --filter desktop-vessel run dist` |
| Generate proto | `pnpm run proto:gen` |
| New migration (shore) | `pnpm --filter api-shore prisma migrate dev --name <name>` |
| New migration (vessel) | `pnpm --filter api-vessel run db:gen && pnpm --filter api-vessel run db:migrate` |
| Format | `pnpm run format && dart format apps/mobile` |

---

## 7. Coding Conventions (mandatory)

- **TypeScript strict mode** everywhere. No `any` without an inline `// eslint-disable-next-line` and a one-line justification.
- **No file > 400 lines** without explicit reason in commit message.
- **Pure domain logic in `packages/domain`** — no DB, no HTTP, no fs imports there. Test as pure functions.
- **All side-effectful code goes through ports/adapters.** Domain calls a `repository` interface; the adapter is in `apps/*`.
- **Dates** are always stored UTC (`TIMESTAMPTZ` on Postgres, ISO 8601 strings in TS, `DateTime` UTC in Dart). Never store local time.
- **IDs** are ULIDs (string), generated client-side. Never use auto-increment integers.
- **Money** uses `Decimal` (Prisma) / string-encoded decimals — never JS `number`.
- **Quantities** with units always carry the unit (e.g., `{ value: 12.5, unit: "kg" }`). Use a shared `Quantity` type.
- **Multi-tenancy** is enforced at the row level (`tenant_id`) and via Postgres RLS. Never trust application-level filtering alone on shore.
- **Sync-aware tables** must include: `id`, `tenant_id`, `vessel_id` (nullable for shared masters), `hlc` (Hybrid Logical Clock), `updated_at`, `deleted_at` (soft delete only on synced tables).
- **No floating string keys.** All status/type fields are TS string-literal unions or Postgres enums.
- **Errors** thrown by domain code use the `DomainError` class from `packages/domain/errors`. HTTP layer maps to status codes.
- **Logging:** `pino`. Never `console.log` outside scripts. Include `tenant_id`, `vessel_id`, `correlation_id` in every log line.
- **Comments** explain *why*, not *what*. The code shows what.

---

## 8. Domain Glossary (read once, then reference)

You will encounter maritime terms. Use them correctly in code, schema, and UI strings.

| Term | Meaning |
|---|---|
| **PMS** | Planned Maintenance System. The core scheduled-maintenance module. |
| **SFI** | SFI Coding & Classification System. Six-digit hierarchical equipment codes used in shipping. |
| **Component** | A piece of shipboard equipment (an engine, a pump, a valve). Hierarchical. |
| **Job** | A maintenance task on a Component. May be scheduled by interval (calendar) or running hours. |
| **Running hours** | Operating-hour counter on a Component (engine running hours, pump running hours). Drives interval-based jobs. |
| **ROB** | Remaining On Board. Stock or fuel quantity currently on the vessel. |
| **BDN** | Bunker Delivery Note. Document accompanying a fuel delivery. |
| **FLGO** | Fuel / Liquids / Gas / Oil — Marad's tank-management module name. Use the same name. |
| **QHSE** | Quality, Health, Safety, Environment. |
| **CAPA** | Corrective Action / Preventive Action. Workflow that follows a finding. |
| **ISM** | International Safety Management Code. IMO regulation requiring SMS. |
| **SMS** | Safety Management System. Required by ISM. |
| **MLC 2006** | Maritime Labour Convention. Governs crew rest hours. |
| **Class society** | Organisation that certifies vessels (DNV, ABS, Lloyd's Register, BV, RINA, NK). |
| **Type-approval** | Class-society approval that a piece of software is acceptable as a vessel's PMS of record. |
| **IMO DCS** | IMO Data Collection System (fuel-oil consumption reporting). |
| **EU MRV** | EU Monitoring, Reporting, Verification of CO2 emissions. |
| **CII** | Carbon Intensity Indicator. Annual rating per vessel. |
| **Master / Chief Eng** | Captain / Chief Engineer. Common approver roles in workflows. |
| **Requisition** | A request to procure a part. Pre-PO. |
| **PO** | Purchase Order. Issued to a supplier. |
| **RFQ** | Request For Quote. Sent to multiple suppliers before issuing a PO. |
| **GRN** | Goods Receipt Note. Records what was actually received against a PO. |
| **2BA / Nareto** | Third-party technical product databases used by maritime industry. We integrate, we do not duplicate. |
| **OCIMF** | Oil Companies International Marine Forum. Source of vetting standards. |

---

## 9. Module Specifications

For each module: purpose, primary entities, key behaviors, and acceptance criteria. These are the user-facing modules that must exist for parity with marad.com.

### 9.1 Maintenance (PMS)

- **Entities:** `Component`, `MasterComponent` (template), `ComponentGroup`, `Job` (template), `JobInstance` (scheduled occurrence), `JobHistory` (signed-off record), `RunningHourReading`.
- **Key behaviors:**
  - Hierarchical components (parent_id self-FK), supporting SFI or custom grouping.
  - Job templates with interval-by-calendar AND/OR interval-by-running-hours; combinable.
  - Running hour counter feed: manual entry, API push, or PLC integration.
  - Sign-off captures: completed_at, by_user, hours_worked, parts_consumed (link to inventory), photos, notes, e-signature hash.
  - Master library: clone a `MasterComponent` into a Vessel; later updates to the master can optionally cascade.
  - Project planning: a `Project` (e.g., dry-dock) groups Jobs with start dates and dependencies; renders as a Gantt.
- **Acceptance:** all of these pass:
  - Create a Component, attach a Job with 250-running-hour interval, push 251 hours, see one open `JobInstance`.
  - Sign off the JobInstance with a part consumed → inventory ROB drops by the consumed amount.
  - Closed `JobHistory` records are immutable in the DB (enforced by trigger or app-level guard).
  - Export DNV-format PMS report.

### 9.2 Inventory

- **Entities:** `Part`, `PartCategory`, `StockLocation` (hierarchical), `StockLevel` (part × location), `StockMovement`, `BarcodeBinding`.
- **Key behaviors:**
  - Min / Max / Reorder point per (Part × StockLocation).
  - Color status: green (≥ min), amber (< min, ≥ reorder), red (≤ reorder), purple (zero).
  - Right-click "Purchase this part" creates a draft `Requisition` with the part pre-filled.
  - Inventory Library: `MasterPart` distributable to other vessels.
  - Barcode scan in mobile app uses the device camera; binding table maps barcode→part.
  - Stock-take with variance report.
- **Acceptance:**
  - Movement-sourced ledger: ROB at any point in time reconstructable by replaying `StockMovement`.
  - Cycle-count posts a single `StockMovement` of type `ADJUSTMENT` with reason text.

### 9.3 Purchase

- **Entities:** `Requisition`, `RequisitionLine`, `RFQ`, `Quote`, `PurchaseOrder`, `POLine`, `GoodsReceipt`, `Supplier`, `ApprovalFlow`, `ApprovalStep`.
- **Key behaviors:**
  - Approval flows: configurable n-step, by approver group, with per-step financial limits per role per group (e.g., `master ≤ €5k`, `purchase_manager ≤ €50k`).
  - Multiple requisitions consolidated into one PO.
  - RFQ to N suppliers; side-by-side quote comparison; one-click "convert to PO".
  - PO lifecycle: `draft → approved → sent → confirmed → in_transit → received → invoiced → closed`.
  - GRN with discrepancy handling (short, damaged, wrong item) — partial receipts allowed.
- **Acceptance:**
  - A €60k requisition cannot be approved by a `purchase_manager` (limit €50k); the UI shows it requires escalation; an audit row records the attempt.
  - Receiving 8 of 10 items leaves the PO `in_transit` with a back-order line.

### 9.4 Certificates

- **Entities:** `Certificate` (polymorphic owner: vessel | component | crew_member), `CertificateType`, `CertificateAttachment`.
- **Key behaviors:**
  - Expiry alerts at configurable thresholds per type (default 90/60/30/7).
  - Renewal action can spawn a Job, a Requisition, or a survey request.
  - Document attachments stored in object storage (S3/MinIO).
- **Acceptance:** Certificate expiring in 30 days emits an in-app and email notification to the assigned reviewer.

### 9.5 Crewing

- **Entities:** `CrewMember`, `Rotation`, `RestHourEntry`, `CrewCertificate` (subclass of Certificate).
- **Key behaviors:**
  - MLC 2006 rest-hour validation: ≥10h rest in 24h, ≥77h rest in 7d.
  - Rotation planning: scheduled boarding/disembarking dates per vessel.
  - Linked from Safety drills (participant list).
- **Acceptance:** A planned roster that violates MLC 2006 is flagged before save.

### 9.6 FLGO

- **Entities:** `Tank`, `Product`, `TankReading`, `BunkerDeliveryNote`, `ConsumptionLog`.
- **Key behaviors:**
  - Daily soundings; sensor or manual.
  - BDN with quantity, density, sulphur, supplier, port, ISO 8217 grade.
  - Reports: IMO DCS annual, EU MRV, CII inputs.
- **Acceptance:** A year of soundings + BDNs produces a valid IMO DCS XML export.

### 9.7 Safety

- **Entities:** `Drill`, `DrillRecord`, `WorkPermit`, `PermitTemplate`, `PermitApproval`.
- **Key behaviors:**
  - Drill register with photos and participants linked to Crewing.
  - Permit lifecycle: `requested → risk_assessed → approved → active → closed`.
- **Acceptance:** A hot-work permit cannot be `active` without a completed risk assessment.

### 9.8 QHSE

- **Entities:** `Finding` (observation | non_conformity | near_miss | audit_finding | port_state), `Document`, `DocumentRevision`, `Checklist`, `ChecklistInstance`, `CAPA`.
- **Key behaviors:**
  - Document control: revision history, approval workflow, "controlled copy" stamp.
  - Checklists with "instant sign" via touch — store signature image + user ID + timestamp.
  - CAPA links findings to actions with owners and due dates.
- **Acceptance:** Replacing a controlled document creates a new revision; old revision remains accessible in history.

### 9.9 Start (Fleetview / Dashboard)

- **Entities:** computed views over the above; `Budget`, `BudgetLine`.
- **Key behaviors:**
  - Fleet map / list with per-vessel status pills (overdue PMS / low stock / expiring certs / open findings).
  - Budgets vs actuals per vessel per category.
  - Worklist aggregator (every overdue / due-soon item across modules).
- **Acceptance:** Fleetview renders for 50 vessels in <1.5s on a cold load (shoreside).

### 9.10 Mobile App

- **Surfaces (read-write):** maintenance sign-off, inventory (with barcode scan), purchase order viewing, certificates, safety drill sign-off, FLGO measurements, crew rest hours, QHSE checklist sign-off, photo capture.
- **Acceptance:** Works fully offline against the local vessel API over the ship Wi-Fi; queues writes if vessel API is unreachable.

---

## 10. Git Workflow

- Branch from `main`. Branch names: `feat/<phase>-<slug>`, `fix/<slug>`, `chore/<slug>`.
- **Conventional Commits.** Examples: `feat(maintenance): add running-hour interval scheduling`, `fix(sync): resolve HLC tie-break`, `docs(claude): update progress log`.
- One PR per task in §11. PR description must reference the task ID (e.g., `Closes Phase-1-3`).
- All checks green before merge: lint, typecheck, unit, e2e (where applicable), `pnpm run soak:sync` for any change inside `packages/sync-engine` or `apps/api-*`.
- Squash-merge to `main`.

---

## 11. Build Phases & Tasks (execute top to bottom)

Each task lists: **Goal**, **Steps**, **Verification command**, **Definition of Done**. When done, append to §15 and update §16.

### Phase 0 — Foundation

**P0-1. Initialize monorepo**
- Goal: empty repo with workspaces wired up.
- Steps: `git init`; create `pnpm-workspace.yaml`, `turbo.json`, root `package.json`; add `.editorconfig`, `.gitignore`, `.nvmrc` (`20`).
- Verify: `pnpm install` succeeds with no packages yet.
- DoD: a fresh clone runs `pnpm install` cleanly.

**P0-2. Tooling baselines**
- Goal: ESLint, Prettier, Vitest, TypeScript configs at root.
- Steps: install at root; create `tsconfig.base.json`, `.eslintrc.cjs`, `.prettierrc`, `vitest.config.ts`.
- Verify: `pnpm run lint && pnpm run typecheck && pnpm run test`.
- DoD: green on empty repo.

**P0-3. CI**
- Goal: GitHub Actions running lint/type/test on PR.
- Steps: `.github/workflows/ci.yml` with Node 20 matrix, Flutter 3.22, pnpm cache.
- Verify: open a no-op PR; CI green.
- DoD: required checks configured on `main`.

**P0-4. shared-types + proto packages**
- Goal: `packages/shared-types` with `tenant`, `vessel`, `user`, `role`. `packages/proto` with empty `sync.proto`. Codegen script `proto:gen`.
- Verify: `pnpm run proto:gen` produces TS in `packages/shared-types/src/proto` and Dart in `packages/flutter-shared/lib/proto`.
- DoD: types importable from any app.

**P0-5. domain package skeleton**
- Goal: `packages/domain` with `errors.ts`, `ids.ts` (ULID), `clock.ts` (HLC), `quantity.ts`. 100% unit test coverage.
- Verify: `pnpm --filter domain test -- --coverage` ≥ 95%.
- DoD: pure-TS, no IO imports (enforced by ESLint rule `no-restricted-imports`).

**P0-6. sync-engine package**
- Goal: `packages/sync-engine` implementing outbox + HLC + LWW conflict resolution + delta CRDT for inventory ROB. In-memory adapter for tests.
- Verify: property-based tests (`fast-check`) for commutativity and idempotency. `pnpm run soak:sync` runs a 30-minute simulated 1000-write/1000-conflict scenario with zero data loss.
- DoD: spec doc in `apps/docs/adr/0001-sync-engine.md`.

**P0-7. api-shore skeleton (NestJS + Prisma)**
- Goal: NestJS app, Prisma schema with `Tenant`, `Vessel`, `User`, `Role`. Postgres RLS on every tenant-scoped table.
- Verify: `pnpm --filter api-shore test:e2e` creates a tenant, a vessel, a user, and login returns a JWT.
- DoD: `prisma migrate dev` produces an idempotent migration.

**P0-8. api-vessel skeleton (NestJS + Drizzle + SQLite)**
- Goal: same domain endpoints as api-shore but backed by SQLite. Designed to run inside Electron.
- Verify: integration test creates the same fixtures and they round-trip through SQLite.
- DoD: identical OpenAPI surface to api-shore.

**P0-9. Sync wire-up between api-shore and api-vessel**
- Goal: bidirectional gRPC stream replicating tenant/vessel/user changes. SMTP fallback stub.
- Verify: `pnpm run soak:sync` end-to-end: 24h simulated offline, then sync; zero divergence.
- DoD: ADR `apps/docs/adr/0002-sync-wire-protocol.md` written.

**P0-10. Auth (OIDC + offline JWT)**
- Goal: shore auth via Microsoft Entra OIDC; vessel cached JWT (signed by shore) usable offline up to 30 days.
- Verify: e2e: log in shore, sync to vessel, pull plug, log in on vessel, perform write, restore plug, sync up.
- DoD: token rotation tested.

**Phase 0 verification command (must be green):** `pnpm run ci:full && pnpm run soak:sync`.

### Phase 1 — MVP onboard (Maintenance + Inventory + Purchase)

**P1-1.** Maintenance schema (Component, MasterComponent, Job, JobInstance, JobHistory, RunningHourReading) on shore + vessel; sync-enabled.
**P1-2.** Maintenance API: CRUD + sign-off endpoint with photo upload (multipart).
**P1-3.** Maintenance UI (web + Electron, shared components from `ui-kit`): component tree, job list, sign-off modal.
**P1-4.** Running-hour scheduling logic with property-based tests.
**P1-5.** Inventory schema (Part, StockLocation, StockLevel, StockMovement); ROB derived from movements only.
**P1-6.** Inventory API + UI: parts list, stock view, min/max config, color status.
**P1-7.** Purchase schema (Requisition, RFQ, Quote, PO, POLine, GoodsReceipt, Supplier, ApprovalFlow).
**P1-8.** Purchase API: requisition → approval (single-step) → PO → GRN.
**P1-9.** Purchase UI: requisition list, approval queue, PO detail, GRN entry.
**P1-10.** Cross-module: signing off a Job consumes parts → emits `StockMovement` → ROB updates → if ROB ≤ reorder, suggest a Requisition.
**P1-11.** Mobile app (Flutter): login, view assigned jobs, sign off a job with photo, scan barcode to find a part, adjust stock.
**P1-12.** Pilot deployment runbook (`apps/docs/runbooks/pilot-deploy.md`): how to install on a ship PC.

**Phase 1 verification command:** `pnpm run ci:full && pnpm run e2e:phase1 && pnpm run soak:sync` and a manual checklist in `apps/docs/checklists/phase1.md`.

### Phase 2 — Compliance core

**P2-1.** Certificates (vessel/component/crew) with reminders and email/in-app notifications.
**P2-2.** Safety: drill register, work permit lifecycle.
**P2-3.** QHSE: documents with revision control, checklists with instant-sign, findings, CAPA.
**P2-4.** Crewing: master records, certificates of competency, MLC 2006 rest-hour validation.
**P2-5.** Engage class society: prepare DNV CG-0339 evidence pack from `JobHistory` immutability and `AuditEvent` log.

**Phase 2 verification command:** `pnpm run ci:full && pnpm run e2e:phase2`.

### Phase 3 — Operational depth

**P3-1.** FLGO: tanks, soundings, BDN; IMO DCS / EU MRV / CII reports.
**P3-2.** Project planning (Gantt) for dry-dock and refit.
**P3-3.** Multi-step approval flows by amount and group.
**P3-4.** Supplier RFQ comparison.
**P3-5.** Mobile app feature-parity for daily on-deck use across all modules.

### Phase 4 — Fleet & integration

**P4-1.** Start (Fleetview) dashboard; budgets vs actuals.
**P4-2.** Integrations: 2BA, Nareto, OCIMF, accounting connector (CSV first, then SAP/Exact/NetSuite), Microsoft Entra SSO finalised.
**P4-3.** Class-society e-reporting connectors (DNV Veracity, ABS My Digital Fleet, LR ClassDirect).
**P4-4.** BI: embed Apache Superset for reports.
**P4-5.** Type-approval audit; ISO 27001 readiness review.

### Phase 5 — Hardening & launch

**P5-1.** SMTP-fallback sync hardened and audited.
**P5-2.** Localization (DE / NL / EN / FIL / RU / GR / ZH).
**P5-3.** Performance: fleetview < 1.5s on 50 vessels; vessel cold start < 5s.
**P5-4.** Pen test (third-party).
**P5-5.** GA launch.

---

## 12. Definition of Done (universal)

A task is done only if **all** are true:
- Code merged to `main` via PR.
- All checks green (lint, typecheck, unit, e2e where applicable, soak where applicable).
- Migrations are idempotent and reversible.
- Public-facing API change documented in OpenAPI / proto.
- ADR written if the task introduces a non-trivial architectural choice.
- `CLAUDE.md` updated: §15 progress log entry, §16 next action, and §3/§4 if versions or layout changed.
- For UI changes: at least one screenshot in the PR description.
- For sync-touching changes: `pnpm run soak:sync` was run locally.

---

## 13. Forbidden / IP Rules (must follow)

- Do **not** view, fetch, screenshot, or scrape marad.com beyond what's already cited in §18. Implement features based on the public descriptions only.
- Do **not** copy Marad icons, screenshots, color palettes, marketing copy, or on-screen text. Build your own UI language.
- Do **not** redistribute the SFI dataset. License it, or let users import their own SFI list.
- Do **not** ingest 2BA / Nareto data without a customer-supplied license. Integrate via API only.
- Do **not** name any class, file, or product "Marad" / "MaraSoft". The repo's working name is `marad-clone`; the production name will be set in §17 before any public release.
- Do **not** add a dependency or third-party API without recording it in §3.
- Do **not** invent maritime regulation. If a regulation isn't in §8 or §9, ask the human.

---

## 14. Common Pitfalls (saved for future Claude Code sessions)

- **Workspace package ESM/CJS dual-mode (IMPORTANT — read before touching `packages/*` configs).** `tsconfig.base.json` uses `module: NodeNext` + `verbatimModuleSyntax: true`, so each file's ESM/CJS classification follows the nearest `package.json#type`. Packages consumed by *both* vitest (ESM, reads `.ts` source) and NestJS-via-ts-node (CJS, reads compiled `dist/`) must be dual-mode: keep `"type":"module"` at the package root (so source `export`/`import` typechecks under NodeNext), and have the build script also write `dist/package.json` containing `{"type":"commonjs"}` — this overrides the parent for the dist subtree only, so Node treats compiled output as CJS at runtime. See `packages/domain/package.json`'s `build` script (`tsc && node -e "...writeFileSync('dist/package.json', ...)"`). Symptoms if mismatched: TS1287/TS1295 from root typecheck (source classified as CJS), or `ReferenceError: exports is not defined in ES module scope` at runtime (compiled CJS classified as ESM). Same pattern needed for `sync-engine` and any future shared TS package.
- **Floating-point money.** Use `Prisma.Decimal` / decimal strings end-to-end. Never `number`.
- **JS `Date` time zones.** Always store and serialize UTC ISO 8601. Do timezone conversion at the edge.
- **SQLite WAL on shutdown.** Electron must call `db.pragma('wal_checkpoint(TRUNCATE)')` before quit, or sync gets out of sync after a hard reboot.
- **Multi-tenant leakage.** Add a Postgres RLS policy on every tenant-scoped table the same commit you create the table.
- **HLC drift.** Vessel clocks lie. Always increment HLC on read of a remote event, never trust `Date.now()` alone.
- **PDF/photo storage in DB.** Don't. Use S3/MinIO and store the key.
- **Long files.** Split anything trending past 400 lines.
- **Skipping the soak test.** Sync bugs only surface under load + offline windows. Run the soak.
- **Orphan node processes on Windows.** `nest start --watch` spawns a child node; killing the pnpm/nest wrapper does not always cascade. After cancelled dev runs, check `Get-NetTCPConnection -LocalPort <port>` and `Stop-Process -Id <OwningProcess>` before starting again, or you'll hit `EADDRINUSE`.

---

## 15. Progress Log (Claude Code updates this)

> Append a dated entry, most-recent first. Format: `### YYYY-MM-DD — <task> — <summary>` then bullets for PR/commit, files added/modified, departures from §11, verify, next.

### 2026-05-06 — P0-9 — sync wire protocol — PR #8 (feat/p0-9-sync-wire)

Bidi gRPC stream between shore and vessel; ADR `apps/docs/adr/0002-sync-wire-protocol.md` is the design source.

- `packages/proto/sync.proto` — `SyncService.Stream` bidi RPC; `Hello/Welcome/DeltaBatch/Ack/Heartbeat/Error`; cursor-based resume, batch acks, JSON-encoded LWW payloads in `Delta.payload` bytes. Codegen via `proto:gen`.
- **Schema** — added `hlc` + `deletedAt` to `Tenant`/`Vessel`/`User` on both Prisma (shore) and Drizzle (vessel); new `outbox` + `sync_records` tables on each side (RLS on shore). Migrations: shore `20260505205702_add_sync_fields`, vessel `0001_concerned_william_stryker.sql`.
- **`SyncAdapter` made async** — Prisma is async; engine.ts + InMemoryAdapter + tests + soak migrated.
- **`packages/sync-engine/src/transport/`** — `transport.ts` (`SyncTransport`), `grpc-transport.ts` (`startSyncServer`, `GrpcSyncTransport`; @grpc/grpc-js + @grpc/proto-loader, runtime-load .proto), `smtp-transport.ts` (interface stub per ADR §6).
- **DB adapters** — `apps/api-vessel/src/sync/drizzle-sync-adapter.ts` (raw SQL on better-sqlite3) + 6 unit tests; `apps/api-shore/src/sync/prisma-sync-adapter.ts` scoped per (tenant, vessel) + 5 e2e tests against real Postgres.
- **NestJS modules** — `SyncModule` registered on both AppModules. Vessel exports `DrizzleSyncAdapter` singleton; shore exports a `PrismaSyncAdapterFactory` (one adapter per active vessel session per ADR §9). Transport boot intentionally deferred — see §16.
- **Soak** — `scripts/sync-soak-test.ts` Phase 1 keeps the original P0-6 in-process scenario; new Phase 2 routes 200 writes/side over a real loopback gRPC stream, 0 diverged.
- **Tooling** — Dart `protoc-gen-dart` v25.0.0 installed at `~\AppData\Local\Pub\Cache\bin\protoc-gen-dart.bat`. `shared-types` gains `rxjs` (ts-proto's `Observable` import). `api-shore` gains `ulidx` for tests.

**New deps:** `@grpc/grpc-js@^1.14.3`, `@grpc/proto-loader@^0.8.0` on `sync-engine`; `rxjs@^7.8.2` on `shared-types`; `ulidx` on `api-shore`.

**Verify:** sync-engine 54 ✓ (added 4 grpc-transport tests); api-vessel test 6 ✓ + test:e2e 8 ✓; api-shore test:e2e 12 ✓ (added 5 sync-adapter); `pnpm -w run ci:full` → 112 ✓; `pnpm -w run soak:sync` → both phases PASS, 0 diverged.

**Deferred (P0-9 follow-up):** auto-start of the gRPC server on api-shore boot and the gRPC client on api-vessel boot. Needs runtime config (server URL, JWT loading, backoff, heartbeat cadence) and real entity controllers that emit through `outbox`. The wire mechanics are proven; this is plumbing.

---

### 2026-05-05 — P0-6 / P0-7 / P0-8 (consolidated, all merged to main)

| Task | PR | Key output |
|---|---|---|
| P0-6 sync-engine package | PR #4 / `7e7dacd` | `packages/sync-engine/` (engine, in-memory adapter, outbox, LWW, PN-Counter); ADR 0001; `scripts/sync-soak-test.ts` (30-min sim, 1000 vessel + 1000 shore writes); `tsx@4.21.0`, `fast-check@4.7.0` to root |
| P0-7 api-shore skeleton | PR #6 / `a2082b5` | NestJS 11 + Prisma 7 + Postgres 16 (Docker on **5433**); `Tenant/Vessel/User` schema with RLS via `app.current_tenant_id`; `withTenant()` wrapper; bcrypt 12-round users; 8h JWT; 7 e2e tests |
| P0-8 api-vessel skeleton | PR #7 / `a3b5537` | NestJS + Drizzle + better-sqlite3; same surface as shore mirrored to SQLite; 8 e2e tests; `Role` as const-array type (no Prisma dep on vessel); `MIGRATIONS_DIR` for Electron; dual-mode `packages/domain` build (see §14 ESM/CJS pitfall) |

---

### 2026-05-01 — P0-1 through P0-5 (consolidated)

| Task | Commit | Key output |
|---|---|---|
| P0-1 Init monorepo | `d02edee` | `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc` (24.15.0), `.gitattributes` |
| P0-2 Tooling | `5381cdb` | `tsconfig.base.json`, `eslint.config.mjs` (flat config), `.prettierrc.json`, `vitest.config.ts` |
| P0-3 CI | `a62635f`, `91c4015` | `.github/workflows/ci.yml`; branch ruleset id `15824020` on main |
| P0-4 shared-types + proto | PR #2 / `b6d626f` | `packages/shared-types/`, `packages/proto/sync.proto`, `packages/flutter-shared/`, `scripts/proto-gen.mjs` |
| P0-5 domain skeleton | PR #3 / `95d8240` | `packages/domain/` — `errors.ts`, `ids.ts` (ULID), `clock.ts` (HLC), `quantity.ts`; 52 tests, ≥95% coverage |

**Local tooling (Windows):** Node 24.15.0, pnpm 10.33.2 standalone (NOT Corepack), gh 2.92.0, protoc 34.1, Dart SDK 3.11.5 standalone (Flutter deferred to P1-11), Docker Desktop.

**Key pinned deps:** `typescript@5.9.3`, `eslint@10.2.1`, `typescript-eslint@8.59.1`, `vitest@4.1.5`, `ts-proto@2.11.6`, `ulidx@2.4.1`. ESLint domain-purity rule blocks `node:fs/http/net/…` in `packages/domain/src/**`.

**Repo:** public on GitHub Free throughout development; flip private at Phase 4–5 pre-launch (see memory `project_repo_visibility.md`).

**Verify:** `pnpm run ci:full` ✓; CI on PRs #1–#3 ✓; ruleset `enforcement: active` ✓.

---

## 16. Next Action

> Single, unambiguous next task for any fresh Claude Code session.

**Task: P0-10 — Auth (OIDC + offline JWT).** Spec: §11 → Phase 0 → P0-10. Shore auth via Microsoft Entra OIDC; vessel cached JWT (signed by shore) usable offline up to 30 days. Verify with end-to-end e2e: log in shore, sync to vessel, pull plug, log in on vessel, perform write, restore plug, sync up. Token rotation tested.

**Or, continue P0-9 follow-up** if the human wants the sync transport actually booting on app start before P0-10:
- `apps/api-shore/src/sync/sync-gateway.service.ts` — boot `startSyncServer` on app init bound to `process.env.SYNC_GRPC_PORT`; route incoming streams to per-(tenant, vessel) `SyncEngine` instances using the `PrismaSyncAdapterFactory` already exported by `SyncModule`.
- `apps/api-vessel/src/sync/sync-client.service.ts` — boot `GrpcSyncTransport` on app init pointed at `process.env.SHORE_SYNC_URL`, with reconnect backoff + heartbeat per ADR 0002 §5.
- Wire any controller-driven write (e.g. `TenantController.create`) through the `SyncEngine.write` path so the outbox actually fills.


---

## 17. Open Questions for the Human

These are decisions only the human (Ziad) can make. Ask before acting.

- [ ] **Production product name.** Working title is `marad-clone`. Final name needed before §11 P4 onwards. Trademark check required.
- [ ] **First pilot vessel.** Which ship, when, with what offline-window expectations.
- [ ] **Class society for initial type-approval.** DNV (most common for Marad), or another?
- [ ] **Hosting target for shore.** AWS / Azure / on-prem / customer-private-cloud?
- [ ] **Accounting integration target.** SAP / Exact / Twinfield / NetSuite / other?
- [ ] **Initial languages besides English.** Likely Dutch given the Marasoft customer base, but confirm.
- [ ] **2BA / Nareto licensing.** Will the company license these directly, or skip until a customer asks?

---

## 18. Sources (Marad public material)

Use only these for "what Marad does" reference. Do not browse beyond them. Module-specific pages (Maintenance / Inventory / Purchase / QHSE / Safety / FLGO / Crewing / Start) are reachable from the Features index.

- Marad — Brochure (PDF) — https://marad.com/wp-content/uploads/2025/12/Marad-Brochure.pdf
- Marad — Features index — https://marad.com/features/
- Marad — Compliance — https://marad.com/compliance/
- Marad — Integrations — https://marad.com/integrations/
- Marad — Marad App (mobile) — https://marad.com/marad-app/
- Marad — Cloud site — https://marad.cloud/
- MaraSoft Generic API — https://external.marad.ms/index.html

---

## 19. Companion Document

The human-readable / stakeholder-facing version of this plan is `MARAD-equivalent-build-plan.docx` (same folder). That file is informational and not maintained alongside code; **this `CLAUDE.md` is the source of truth for execution.**
