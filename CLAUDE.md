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
| Backend | NestJS | `10.x` |
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
| ORM (shore) | Prisma | `5.x` (Postgres provider) |
| ORM (vessel) | Drizzle ORM | latest stable (SQLite provider via `better-sqlite3`) |
| Sync RPC | gRPC | `@grpc/grpc-js 1.10+` |
| Sync proto | Protobuf (`protoc 34+`, `ts-proto 2.11+` for TS, `protoc_plugin 25+` for Dart) | `proto3` |
| Postgres | PostgreSQL | `16.x` |
| SQLite | SQLite | `3.45+` (ships with `better-sqlite3`) |
| Search (shore) | Meilisearch | `1.8+` |
| Object store | S3-compatible (MinIO for local dev) | latest |
| Auth | OIDC via `openid-client` | `5.x` |
| Logging | pino | `9.x` |
| Testing | Vitest, Playwright (e2e), flutter_test | `vitest 4.x`, Playwright/flutter_test latest stable |
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

- **Floating-point money.** Use `Prisma.Decimal` / decimal strings end-to-end. Never `number`.
- **JS `Date` time zones.** Always store and serialize UTC ISO 8601. Do timezone conversion at the edge.
- **SQLite WAL on shutdown.** Electron must call `db.pragma('wal_checkpoint(TRUNCATE)')` before quit, or sync gets out of sync after a hard reboot.
- **Multi-tenant leakage.** Add a Postgres RLS policy on every tenant-scoped table the same commit you create the table.
- **HLC drift.** Vessel clocks lie. Always increment HLC on read of a remote event, never trust `Date.now()` alone.
- **PDF/photo storage in DB.** Don't. Use S3/MinIO and store the key.
- **Long files.** Split anything trending past 400 lines.
- **Skipping the soak test.** Sync bugs only surface under load + offline windows. Run the soak.

---

## 15. Progress Log (Claude Code updates this)

> Append a dated entry every time you finish a task. Most-recent entry first.

### 2026-05-01 — P0-5 — domain package skeleton
- Branch: `feat/p0-5-domain` → PR (see `gh pr list`) → squash-merged to `main`.
- Files added: `packages/domain/{package.json,tsconfig.json,vitest.config.ts}`, plus `src/{index,errors,errors.test,ids,ids.test,clock,clock.test,quantity,quantity.test}.ts`.
- Modified: `eslint.config.mjs` (added domain-purity restriction rule).
- Tooling: `ulidx@2.4.1` as runtime dep of `@marad-clone/domain`.
- Modules:
  - **`errors.ts`** — `DomainError extends Error` with `code: DomainErrorCode`, frozen `details`. Codes: `INVALID_INPUT | NOT_FOUND | CONFLICT | PRECONDITION_FAILED | UNAUTHORIZED | FORBIDDEN | INTERNAL`. `isDomainError` type guard.
  - **`ids.ts`** — branded `Ulid` type. `newId()` (monotonic via `ulidx.monotonicFactory`), `nonMonotonicUlid()` re-export, `asUlid(s)` (validating parse → throws `INVALID_INPUT`), `isUlid(s)` guard, `idTimestampMs(id)`.
  - **`clock.ts`** — Hybrid Logical Clock per Kulkarni 2014. `Hlc` interface (`physicalMs`, `counter`, `nodeId`). `encodeHlc/decodeHlc` produce a lexically-sortable string `<12-hex-ms>-<4-hex-counter>-<nodeId>` (48-bit ms safe to year ~10889, 16-bit counter). `compareHlc` total order. `HlcClock` class with `send()`, `receive(remote)`, `current()`, injectable `now: () => number`.
  - **`quantity.ts`** — branded `Quantity<U>`. Unit categories: `MassUnit`, `VolumeUnit`, `LengthUnit`, `TimeUnit`, `CountUnit`, `EnergyUnit` (string-literal unions per §7). `quantity(value, unit)` constructor (rejects non-finite). `addQuantities` (rejects unit mismatch — runtime check, since TS generic widens to union). Per-category converters to base units (`massInKg`, `volumeInLitre`, `lengthInMetre`, `timeInSecond`, `energyInJoule`). `formatQuantity` for display.
- **Domain-purity ESLint rule** added in `eslint.config.mjs`: files under `packages/domain/src/` cannot import any of `node:fs / http / https / child_process / net / tls / dgram / dns / cluster / worker_threads / inspector / path / os / stream / process / crypto` (with or without `node:` prefix). Enforces §7's "no IO in domain" rule at lint time. Side-effectful code goes through ports/adapters in `apps/*`.
- **Coverage gate** in `packages/domain/vitest.config.ts`: ≥95% lines/branches/functions/statements. `src/index.ts` excluded (re-exports only).
- Verify (P0-5 DoD):
  - `pnpm --filter @marad-clone/domain test:coverage` → 52 tests pass; **98.83% stmt / 95.08% branch / 100% fn / 98.79% lines** (all ≥ 95%) ✓
  - `pnpm run ci:full` (root) → green (lint + typecheck + test + format:check) ✓
  - Domain has no IO imports (would fail ESLint if violated) ✓
- Notes:
  - One uncovered line in `clock.ts` (`decodeHlc` post-regex defensive validation): unreachable because the regex already constrains hex chars and non-empty nodeId. Left in for safety.
  - §11 P0-5 goal says "100% coverage", verify says "≥95%". Took the verify gate as the DoD.
  - **Sub-decisions per Ziad**: ulidx, standard Kulkarni HLC, branded `Quantity`, root vitest stays as-is (per-package `vitest.config.ts` only for domain because it's the only one with a coverage gate so far).
  - **Workspace structure shift**: each package now has its own `lint`/`typecheck`/`test` scripts (matching pnpm/turbo convention); root scripts (`pnpm run lint/typecheck/test`) still scan the whole repo directly via flat ESLint config + root tsconfig include + root vitest discovery — turbo delegation deferred until per-package builds matter.
- Next: **P0-6** — sync-engine package (outbox + HLC reuse + LWW + delta CRDT for inventory ROB).

### 2026-05-01 — P0-4 — `shared-types` + `proto` packages
- Branch: `feat/p0-4-shared-types-proto` → PR (see `gh pr list`) → squash-merged to `main`.
- Files added (~17):
  - `packages/shared-types/` — TS package: `package.json`, `tsconfig.json`, `src/{index,sync,tenant,vessel,user,role}.ts`. Generated: `src/proto/sync.ts` (committed).
  - `packages/proto/` — proto schemas: `package.json`, `sync.proto` (placeholder `Heartbeat` message).
  - `packages/flutter-shared/` — Dart package: `pubspec.yaml`. Generated: `lib/proto/sync.{pb,pbenum,pbjson}.dart` (committed).
  - `scripts/proto-gen.mjs` — cross-platform codegen wrapper.
- Modified: root `package.json` (added `ts-proto@2.11.6` + `proto:gen` script), `tsconfig.json` (expanded `include` to `packages/*/src/**/*`), `eslint.config.mjs` (ignore `**/proto/**` for both TS and Dart), `.prettierignore` (ignore generated proto dirs).
- Tooling installed:
  - `protoc 34.1` (winget `Google.Protobuf`) at `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Google.Protobuf_*\bin\protoc.exe`.
  - `Dart SDK 3.11.5` (winget `Google.DartSDK`) — standalone, not Flutter. Flutter SDK + bundled Dart will arrive at **P1-11**.
  - `protoc_plugin 25.0.0` via `dart pub global activate protoc_plugin` → `protoc-gen-dart.bat` at `%LOCALAPPDATA%\Pub\Cache\bin\`.
  - `ts-proto 2.11.6` as workspace dev dep.
- Notes:
  - **Departures from §11 P0-4**:
    - `sync.proto` has a placeholder `Heartbeat` message rather than being *literally* empty (per §11). Empty protos produce empty codegen output; a stub message keeps the codegen path exercised. Real sync messages still defined in **P0-6**.
    - Flutter SDK is NOT installed; only standalone Dart 3.11.5. Re-evaluate at P1-11 — likely uninstall standalone Dart and use Flutter's bundled Dart.
  - **ts-proto options**: `esModuleInterop=true,useExactTypes=true,onlyTypes=true,forceLong=string,useOptionals=messages` → pure-type interfaces, no runtime code, no `protobufjs` dependency. **When P0-6 needs encode/decode, flip `onlyTypes=false` and add `protobufjs` runtime dep.**
  - **Windows-only quirk fixed in `scripts/proto-gen.mjs`**: `protoc-gen-dart.bat` (the pub global shim) shells out to `dart`, which isn't on PATH in shells that pre-date the Dart install. The script prepends the known winget Dart `bin` dir to the protoc subprocess `PATH`. POSIX install is unaffected.
  - **Generated files are committed**, not gitignored. Pattern: regenerate locally with `pnpm run proto:gen`, commit. CI does NOT run codegen (would require installing protoc + Dart on the runner — deferred until proto changes happen often).
  - Root `tsconfig.json` `include` now covers `packages/*/src/**/*` — a single `tsc --noEmit` typechecks the whole monorepo. May need to switch to `tsc -b` (project references) when packages grow build interdependencies.
  - §3 updated: Sync proto row spelled out tooling versions; Mobile row Dart bumped from `3.4+` → `3.11+`.
- Verify (P0-4 DoD):
  - `pnpm run proto:gen` produces `packages/shared-types/src/proto/sync.ts` AND `packages/flutter-shared/lib/proto/sync.{pb,pbenum,pbjson}.dart` ✓
  - `pnpm run ci:full` (lint + typecheck + test + format:check) green ✓
  - Types importable as `@marad-clone/shared-types` from any workspace package ✓
- Next: **P0-5** — domain package skeleton (errors, ids, clock, quantity).

### 2026-05-01 — P0-3 — CI (GitHub Actions)
- Branch: `chore/p0-3-progress-log` → PR (see `gh pr list`) → squash-merged to `main`. Earlier P0-3 commits (`a62635f`, `91c4015`) were direct-pushed to `main` *before* branch protection was applied; that direct-push path is now blocked.
- Files added: `.github/workflows/ci.yml`.
- Notes:
  - Single ubuntu-latest job runs `lint + typecheck + test + format:check`, ~25–35 s wall.
  - Reads Node from `.nvmrc` and pnpm from `packageManager` field — single source of truth.
  - Concurrency group cancels superseded PR runs.
  - All actions pinned at `@v6` (actions/checkout, actions/setup-node, pnpm/action-setup) — `@v4` runs on Node-20 runtime which is deprecated 2026-09-16.
  - Departures from §11 P0-3 spec: (a) Node 20 → 24 in setup, (b) Flutter step deferred to P1-11 (no `apps/mobile/` exists), (c) ubuntu-only matrix; cross-OS (Win/macOS) added when sync/Electron/filesystem code arrives.
  - **Repo flipped public** (`gh repo edit D1ckenS/marad-clone --visibility public`) so branch protection works on the GitHub Free tier. Revisit before P0-7 / first proprietary business logic — see memory `project_repo_visibility.md`.
  - Branch protection: Repository ruleset **"Protect main"** (id `15824020`, https://github.com/D1ckenS/marad-clone/rules/15824020) — blocks deletion + force-push, requires PR (0 approvals, conversation resolution required), requires `ci` status check (strict / up-to-date), no bypass actors.
- Verify (P0-3 DoD): two clean CI runs (run IDs `25209927662` 25 s, `25209955256` 33 s); ruleset reports `enforcement: active`; this very entry's update path goes through a PR (proves direct-push blocking).
- Next: **P0-4** — `shared-types` + `proto` packages.

### 2026-05-01 — P0-2 — Tooling baselines
- Branch: `main`  PR: n/a (no remote yet)  Commit: see `git log` (this commit)
- Files added: `tsconfig.base.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`. Modified: `package.json` (added `"type": "module"`, dev deps, expanded scripts).
- Tooling pinned (latest stable except TypeScript held at 5.x):
  - `typescript@5.9.3` — TS 6.0.3 deferred (released 15 days ago, too new)
  - `eslint@10.2.1` + `typescript-eslint@8.59.1` (flat config)
  - `prettier@3.8.3` + `eslint-config-prettier@10.1.8`
  - `vitest@4.1.5` + `@vitest/coverage-v8@4.1.5`
  - `globals@17.5.0`
  - `@types/node@24.12.2` (matches Node 24 LTS line; held off 25.x)
- Notes:
  - §11 P0-2 originally specified `.eslintrc.cjs`; **replaced with `eslint.config.mjs`** (ESLint 9+ flat config). The legacy format file is not created.
  - `package.json` got `"type": "module"` so TS's `verbatimModuleSyntax` accepts `.ts` config files as ESM. Future packages may opt out per-package as needed.
  - Vitest 4.x errors on "no test files found"; opted in via `passWithNoTests: true` so the empty workspace passes — remove this if/when test discovery is enforced project-wide.
  - Root `tsconfig.json` includes only the dev-tool config files (`eslint.config.mjs`, `vitest.config.ts`); per-package `tsconfig.json`s extend `tsconfig.base.json` directly when packages land.
  - `pnpm run ci:full` now runs lint + typecheck + test + format:check.
  - §3 updated this commit: TS pin bumped to `5.9+`, new rows for ESLint+Prettier, Vitest row clarified to `4.x`.
- Verify (P0-2 DoD): `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run format:check` all green ✓
- Next: **P0-3** — CI (GitHub Actions: lint/typecheck/test on PR, Node 24 matrix, pnpm cache).

### 2026-05-01 — P0-1 — Initialize monorepo
- Branch: `main`  PR: n/a (inaugural commit, no remote yet)  Commit: see `git log` (this commit)
- Files added: `.editorconfig`, `.gitignore`, `.nvmrc` (`24.15.0`), `package.json` (private root, name `marad-clone`), `pnpm-workspace.yaml` (`packages/*`, `apps/*`), `turbo.json` (tasks: build/lint/typecheck/test), `pnpm-lock.yaml`. Branch initialized as `main`.
- Notes:
  - Node 24.15.0 LTS installed system-wide via the official Node installer (NOT fnm — fnm's multishell mechanism produced broken junctions on this Windows machine; abandoned cleanly).
  - pnpm 10.33.2 installed standalone via `npm install -g pnpm@latest` (NOT Corepack — explicit user preference; see memory `feedback_pnpm_standalone.md`).
  - §3 was bumped in this same commit: Node `20.x LTS` → `24.x LTS` (Node 20 LTS was EOL 2026-04-30) and pnpm `9.x` → `10.x`.
  - §5 was rewritten to drop `corepack enable` in favour of `npm install -g pnpm@latest`, and to give platform-neutral install instructions for protoc / Docker.
  - Workspace globs `packages/*` and `apps/*` declared; no packages exist yet (first one lands in P0-4).
  - Turbo 2.9.6 installed; pipeline tasks declared but no workspace package implements them yet — `pnpm run lint`/`typecheck`/`test` are no-ops until P0-2.
- Verify (P0-1 DoD): `pnpm install` succeeds cleanly on the empty workspace ✓
- Next: **P0-2** — Tooling baselines (ESLint, Prettier, Vitest, TypeScript root configs).

Format for entries:
```
### YYYY-MM-DD — <Task ID> — <one-line summary>
- Branch: <name>  PR: #<num>  Commit: <sha>
- Notes: <anything future-you needs to know>
- Next: <task ID from §11>
```

---

## 16. Next Action

> Single, unambiguous next task for any fresh Claude Code session.

**Task: P0-6 — sync-engine package.**

Open §11 → Phase 0 → P0-6 for the steps. Goal: create `packages/sync-engine` implementing outbox + HLC (reuse from `@marad-clone/domain`) + LWW conflict resolution + delta CRDT for inventory ROB. In-memory adapter for tests. Verify: property-based tests with `fast-check` for commutativity and idempotency; `pnpm run soak:sync` runs a 30-minute simulated 1000-write/1000-conflict scenario with zero data loss. DoD: spec doc in `apps/docs/adr/0001-sync-engine.md`. After completion, update §15 and set this section to `P0-7`.

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

Use only these for "what Marad does" reference. Do not browse beyond them.

- Marad — Product Overview — https://marad.com/product/
- Marad — Features index — https://marad.com/features/
- Marad — Maintenance — https://marad.com/features/maintenance/
- Marad — Inventory — https://marad.com/features/inventory/
- Marad — Purchase — https://marad.com/features/purchase/
- Marad — QHSE — https://marad.com/features/qhse/
- Marad — Safety — https://marad.com/features/safety/
- Marad — FLGO — https://marad.com/features/flgo/
- Marad — Crewing — https://marad.com/features/crewing/
- Marad — Start — https://marad.com/features/start/
- Marad — Applications — https://marad.com/applications/
- Marad — Marad App — https://marad.com/marad-app/
- Marad — Integrations — https://marad.com/integrations/
- Marad — Compliance — https://marad.com/compliance/
- Marad — About — https://marad.com/about/
- Marad — Brochure (PDF) — https://marad.com/wp-content/uploads/2025/12/Marad-Brochure.pdf
- Marad — Cloud site — https://marad.cloud/
- MaraSoft Generic API — https://external.marad.ms/index.html
- Capterra — Marad — https://www.capterra.com/p/10024267/Marad/
- GetApp — Marad — https://www.getapp.com/industries-software/a/marad/
- Software Advice — Marad — https://www.softwareadvice.com/product/523037-Marad/
- Apple App Store — Marad — https://apps.apple.com/us/app/marad/id1504414983
- Google Play — Marad — https://play.google.com/store/apps/details?id=com.maradapp

---

## 19. Companion Document

The human-readable / stakeholder-facing version of this plan is `MARAD-equivalent-build-plan.docx` (same folder). That file is informational and not maintained alongside code; **this `CLAUDE.md` is the source of truth for execution.**
