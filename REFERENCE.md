# CLAUDE-REFERENCE.md — Stable reference for MARAD project

> **This file is read at the start of every session, after CLAUDE.md.** It contains all sections that rarely change. Update §3 when bumping a version; update §4 when adding a package or app; update §9 when a module spec is refined.

---

## 1. Project Identity

| Field                  | Value                                                                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project name**       | **FleetOps** (decided 2026-05-12; trademark check required before public release)                                                                                                                                      |
| **What**               | Hybrid maritime fleet management system: planned maintenance, spare parts inventory, procurement, certificates, crewing, fuel/tank logistics, safety, QHSE. Functional parity with Marad by MaraSoft B.V. (marad.com). |
| **Surfaces**           | Onboard desktop (Electron), shoreside web (React), companion mobile (Flutter).                                                                                                                                         |
| **Offline-first**      | Vessel installs run with **full feature parity** offline. Sync to shore when connectivity is available.                                                                                                                |
| **Compliance targets** | DNV type-approval (PMS), ISO 27001, IMO DCS, EU MRV, MLC 2006.                                                                                                                                                         |
| **Success criteria**   | (1) Pilot vessel operating exclusively on the system for 90 days with zero data-loss incidents. (2) DNV type-approval certificate issued for the PMS module. (3) Single tenant with 5 vessels in production.           |

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

> **Note (2026-05-01):** Versions below are re-verified against upstream at the time each tool is first installed — do not blindly trust an entry until the row's `Installed` column has been confirmed.

| Layer            | Tech                                                           | Version                                                                |
| ---------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Node             | Node.js                                                        | `24.x LTS (Krypton, ≥24.15)`                                           |
| Package mgr      | pnpm                                                           | `10.x (≥10.33)`                                                        |
| Monorepo         | Turborepo                                                      | `2.x`                                                                  |
| Backend          | NestJS                                                         | `11.x (11.1.19)`                                                       |
| Backend config   | @nestjs/config                                                 | `4.x (4.0.4)`                                                          |
| Backend lang     | TypeScript                                                     | `5.9+`                                                                 |
| Lint             | ESLint + typescript-eslint                                     | `eslint 10.x` + `typescript-eslint 8.59+` (flat config)                |
| Format           | Prettier                                                       | `3.x`                                                                  |
| ID generation    | ulidx                                                          | `2.4.1+`                                                               |
| Web framework    | React                                                          | `18.x`                                                                 |
| Web routing      | react-router-dom                                               | `6.x`                                                                  |
| Web bundler      | Vite                                                           | `5.x`                                                                  |
| Web styling      | Tailwind CSS                                                   | `3.x`                                                                  |
| Web table        | TanStack Table                                                 | `8.x`                                                                  |
| Desktop shell    | Electron                                                       | `30.x (30.5.1)`                                                        |
| Desktop builder  | electron-builder                                               | `24.x (24.13.3)`                                                       |
| Mobile           | Flutter                                                        | `3.22+` (Dart `3.11+`)                                                 |
| ORM (shore)      | Prisma + `@prisma/client` + `@prisma/adapter-pg`               | `7.x (7.8.0)`                                                          |
| ORM (vessel)     | Drizzle ORM + drizzle-kit + better-sqlite3                     | `drizzle-orm 0.45.2` / `drizzle-kit 0.31.10` / `better-sqlite3 12.9.0` |
| Sync RPC         | gRPC                                                           | `@grpc/grpc-js 1.10+`                                                  |
| Sync proto       | Protobuf (`protoc 34+`, `ts-proto 2.11+`, `protoc_plugin 25+`) | `proto3`                                                               |
| Postgres         | PostgreSQL                                                     | `16.x`                                                                 |
| SQLite           | SQLite                                                         | `3.45+`                                                                |
| Search (shore)   | Meilisearch                                                    | `1.8+`                                                                 |
| Object store     | S3-compatible (MinIO for local dev)                            | latest                                                                 |
| S3 SDK           | @aws-sdk/client-s3                                             | `3.x (^3.1044.0)`                                                      |
| Auth             | OIDC via `openid-client`                                       | `5.x`                                                                  |
| Logging          | pino + pino-http + nestjs-pino                                 | `10.3.1` / `11.0.0` / `4.6.1`                                          |
| Postgres client  | pg + `@prisma/adapter-pg`                                      | `8.20.0` / `7.8.0`                                                     |
| Auth (local)     | bcrypt + `@nestjs/jwt` + `@nestjs/passport` + passport-local   | `6.0.0` / `11.0.2` / `11.0.5` / `1.0.0`                                |
| Validation       | class-validator + class-transformer                            | `0.15.1` / `0.5.1`                                                     |
| HTTP testing     | supertest                                                      | `7.2.2`                                                                |
| Testing          | Vitest, Playwright (e2e), flutter_test                         | `vitest 4.x`, Playwright/flutter_test latest stable                    |
| Property testing | fast-check                                                     | `4.7.0`                                                                |
| Script runner    | tsx                                                            | `4.21.0`                                                               |
| BI / dashboards  | Apache Superset (later phase)                                  | `4.x`                                                                  |

**Rule:** If a package is not listed, justify the addition in the commit message and add it here.

---

## 4. Repository Layout

```
FleetOps/
  CLAUDE.md                  ← Entry point. Read first every session.
  REFERENCE.md               ← THIS FILE. Stable reference.
  PROGRESS.md                ← Progress log + next action (volatile).
  README.md
  pnpm-workspace.yaml
  turbo.json
  .github/workflows/
  .editorconfig
  .gitignore

  packages/
    shared-types/
    proto/
    domain/
    sync-engine/
    ui-kit/
    flutter-shared/

  apps/
    api-shore/
    api-vessel/
    web-shore/
    desktop-vessel/          ← Electron 30 shell (P1-3b)
    mobile/
    docs/

  infra/
    docker-compose.dev.yml
    helm/
    migrations/

  scripts/
    bootstrap.sh
    sync-soak-test.ts
```

**Rule:** When you create a new top-level folder or package, add it to this tree in the same commit.

---

## 5. Dev Environment Setup

```bash
# 1. Tooling
npm install -g pnpm@latest
pnpm install
flutter pub get -C apps/mobile

# 2. Local services
docker compose -f infra/docker-compose.dev.yml up -d

# 3. Database
pnpm --filter api-shore prisma migrate dev
pnpm --filter api-vessel db:migrate

# 4. Codegen
pnpm run proto:gen

# 5. Sanity
pnpm run lint && pnpm run typecheck && pnpm run test
```

---

## 6. Build / Test / Run Commands (canonical)

| Action                  | Command                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| Install everything      | `pnpm install && flutter pub get -C apps/mobile`                                 |
| Lint                    | `pnpm run lint`                                                                  |
| Type-check              | `pnpm run typecheck`                                                             |
| Unit tests              | `pnpm run test`                                                                  |
| E2E tests (web)         | `pnpm --filter web-shore run test:e2e`                                           |
| Mobile tests            | `flutter test -C apps/mobile`                                                    |
| Sync soak test          | `pnpm run soak:sync`                                                             |
| Run shore stack (dev)   | `pnpm run dev:shore`                                                             |
| Run vessel stack (dev)  | `pnpm run dev:vessel`                                                            |
| Run desktop in dev      | `pnpm --filter desktop-vessel run dev`                                           |
| Run mobile (sim)        | `flutter run -C apps/mobile`                                                     |
| Build desktop installer | `pnpm --filter desktop-vessel run dist`                                          |
| Generate proto          | `pnpm run proto:gen`                                                             |
| New migration (shore)   | `pnpm --filter api-shore prisma migrate dev --name <name>`                       |
| New migration (vessel)  | `pnpm --filter api-vessel run db:gen && pnpm --filter api-vessel run db:migrate` |
| Format                  | `pnpm run format && dart format apps/mobile`                                     |

---

## 7. Coding Conventions (mandatory)

- **TypeScript strict mode** everywhere. No `any` without `// eslint-disable-next-line` and a one-line justification.
- **No file > 400 lines** without explicit reason in commit message.
- **Pure domain logic in `packages/domain`** — no DB, no HTTP, no fs imports. Test as pure functions.
- **All side-effectful code goes through ports/adapters.**
- **Dates** always stored UTC. Never store local time.
- **IDs** are ULIDs (string), generated client-side. Never auto-increment integers.
- **Money** uses `Decimal` / string-encoded decimals — never JS `number`.
- **Quantities** with units always carry the unit (`{ value: 12.5, unit: "kg" }`).
- **Multi-tenancy** enforced at row level (`tenant_id`) + Postgres RLS. Never trust app-level filtering alone.
- **Sync-aware tables** must include: `id`, `tenant_id`, `vessel_id`, `hlc`, `updated_at`, `deleted_at`.
- **No floating string keys.** All status/type fields are TS string-literal unions or Postgres enums.
- **Errors** use `DomainError` from `packages/domain/errors`. HTTP layer maps to status codes.
- **Logging:** `pino`. Never `console.log` outside scripts. Include `tenant_id`, `vessel_id`, `correlation_id`.
- **Comments** explain _why_, not _what_.

---

## 8. Domain Glossary

| Term                   | Meaning                                                                         |
| ---------------------- | ------------------------------------------------------------------------------- |
| **PMS**                | Planned Maintenance System.                                                     |
| **SFI**                | SFI Coding & Classification System. Six-digit hierarchical equipment codes.     |
| **Component**          | A piece of shipboard equipment. Hierarchical.                                   |
| **Job**                | A maintenance task on a Component.                                              |
| **Running hours**      | Operating-hour counter on a Component. Drives interval-based jobs.              |
| **ROB**                | Remaining On Board. Stock or fuel quantity currently on the vessel.             |
| **BDN**                | Bunker Delivery Note. Document accompanying a fuel delivery.                    |
| **FLGO**               | Fuel / Liquids / Gas / Oil — Marad's tank-management module name.               |
| **QHSE**               | Quality, Health, Safety, Environment.                                           |
| **CAPA**               | Corrective Action / Preventive Action.                                          |
| **ISM**                | International Safety Management Code.                                           |
| **SMS**                | Safety Management System.                                                       |
| **MLC 2006**           | Maritime Labour Convention. Governs crew rest hours.                            |
| **Class society**      | Organisation that certifies vessels (DNV, ABS, Lloyd's Register, BV, RINA, NK). |
| **Type-approval**      | Class-society approval for a vessel's PMS of record.                            |
| **IMO DCS**            | IMO Data Collection System (fuel-oil consumption reporting).                    |
| **EU MRV**             | EU Monitoring, Reporting, Verification of CO2 emissions.                        |
| **CII**                | Carbon Intensity Indicator. Annual rating per vessel.                           |
| **Master / Chief Eng** | Captain / Chief Engineer. Common approver roles.                                |
| **Requisition**        | A request to procure a part. Pre-PO.                                            |
| **PO**                 | Purchase Order.                                                                 |
| **RFQ**                | Request For Quote.                                                              |
| **GRN**                | Goods Receipt Note.                                                             |
| **2BA / Nareto**       | Third-party technical product databases. Integrate via API only.                |
| **OCIMF**              | Oil Companies International Marine Forum.                                       |

---

## 9. Module Specifications

### 9.1 Maintenance (PMS)

- **Entities:** `Component`, `MasterComponent`, `ComponentGroup`, `Job`, `JobInstance`, `JobHistory`, `RunningHourReading`.
- **Key behaviors:** Hierarchical components (SFI or custom); interval-by-calendar and/or running-hours; sign-off captures photo, parts consumed, e-signature; master library with optional cascade; Gantt project planning.
- **Acceptance:** Create component → 250h job → push 251h → open JobInstance. Sign off → inventory ROB drops. `JobHistory` immutable in DB. DNV-format PMS report exports.

### 9.2 Inventory

- **Entities:** `Part`, `PartCategory`, `StockLocation`, `StockLevel`, `StockMovement`, `BarcodeBinding`.
- **Key behaviors:** Min/Max/Reorder per Part×Location; color status (green/amber/red/purple); right-click "Purchase" creates draft Requisition; barcode scan via mobile camera; stock-take with variance report.
- **Acceptance:** ROB reconstructable by replaying `StockMovement`. Cycle-count posts `ADJUSTMENT` movement.

### 9.3 Purchase

- **Entities:** `Requisition`, `RequisitionLine`, `RFQ`, `Quote`, `PurchaseOrder`, `POLine`, `GoodsReceipt`, `Supplier`, `ApprovalFlow`, `ApprovalStep`.
- **Key behaviors:** N-step approval flows with per-role financial limits; multi-requisition PO consolidation; RFQ to N suppliers with comparison; PO lifecycle `draft→closed`; partial GRN receipts.
- **Acceptance:** €60k requisition blocked for `purchase_manager` (limit €50k). Receiving 8/10 items leaves PO `in_transit`.

### 9.4 Certificates

- **Entities:** `Certificate` (polymorphic: vessel|component|crew_member), `CertificateType`, `CertificateAttachment`.
- **Key behaviors:** Expiry alerts at configurable thresholds (default 90/60/30/7 days); renewal spawns Job/Requisition/survey; attachments in S3/MinIO.
- **Acceptance:** Certificate expiring in 30 days emits in-app + email notification.

### 9.5 Crewing

- **Entities:** `CrewMember`, `Rotation`, `RestHourEntry`, `CrewCertificate`.
- **Key behaviors:** MLC 2006 validation (≥10h/24h, ≥77h/7d); rotation planning; linked from safety drills.
- **Acceptance:** MLC-violating roster flagged before save.

### 9.6 FLGO

- **Entities:** `Tank`, `Product`, `TankReading`, `BunkerDeliveryNote`, `ConsumptionLog`.
- **Key behaviors:** Daily soundings; BDN with quantity/density/sulphur/grade; IMO DCS / EU MRV / CII reports.
- **Acceptance:** Year of soundings + BDNs → valid IMO DCS XML.

### 9.7 Safety

- **Entities:** `Drill`, `DrillRecord`, `WorkPermit`, `PermitTemplate`, `PermitApproval`.
- **Key behaviors:** Drill register with photos + participants; permit lifecycle `requested→closed`.
- **Acceptance:** Hot-work permit cannot be `active` without completed risk assessment.

### 9.8 QHSE

- **Entities:** `Finding`, `Document`, `DocumentRevision`, `Checklist`, `ChecklistInstance`, `CAPA`.
- **Key behaviors:** Document control with revision history; checklists with instant-sign (signature image + user ID + timestamp); CAPA with owners and due dates.
- **Acceptance:** Replacing a controlled document creates new revision; old revision accessible in history.

### 9.9 Start (Fleetview / Dashboard)

- **Entities:** computed views; `Budget`, `BudgetLine`.
- **Key behaviors:** Fleet map/list with per-vessel status pills; budgets vs actuals; worklist aggregator.
- **Acceptance:** Fleetview renders for 50 vessels in <1.5s (shoreside cold load).

### 9.10 Mobile App

- **Surfaces:** maintenance sign-off, inventory (barcode scan), PO viewing, certificates, safety drill sign-off, FLGO measurements, crew rest hours, QHSE checklist sign-off, photo capture.
- **Acceptance:** Works fully offline against local vessel API over ship Wi-Fi; queues writes if unreachable.

---

## 10. Git Workflow

- Branch from `main`. Names: `feat/<phase>-<slug>`, `fix/<slug>`, `chore/<slug>`.
- **Conventional Commits.** One PR per task in §11 of PROGRESS.md. PR description must reference task ID.
- All checks green before merge: lint, typecheck, unit, e2e, soak (for sync/api changes).
- Squash-merge to `main`.

---

## 11. Build Phases & Tasks

### Phase 0 — Foundation (COMPLETE)

P0-1 through P0-10 all merged. See PROGRESS.md for details.

**Phase 0 verification:** `pnpm run ci:full && pnpm run soak:sync` ✓

### Phase 1 — MVP onboard (Maintenance + Inventory + Purchase)

**P1-1.** Maintenance schema (Component, MasterComponent, Job, JobInstance, JobHistory, RunningHourReading) on shore + vessel; sync-enabled. ✓
**P1-2.** Maintenance API: CRUD + sign-off endpoint with photo upload (multipart). ✓
**P1-3.** Maintenance UI (web + Electron, shared components from `ui-kit`): component tree, job list, sign-off modal.
**P1-4.** Running-hour scheduling logic with property-based tests.
**P1-5.** Inventory schema (Part, StockLocation, StockLevel, StockMovement); ROB derived from movements only.
**P1-6.** Inventory API + UI: parts list, stock view, min/max config, color status.
**P1-7.** Purchase schema (Requisition, RFQ, Quote, PO, POLine, GoodsReceipt, Supplier, ApprovalFlow).
**P1-8.** Purchase API: requisition → approval (single-step) → PO → GRN.
**P1-9.** Purchase UI: requisition list, approval queue, PO detail, GRN entry.
**P1-10.** Cross-module: signing off a Job consumes parts → `StockMovement` → ROB updates → suggest Requisition if ROB ≤ reorder.
**P1-11.** Mobile app (Flutter): login, view assigned jobs, sign off with photo, barcode scan, adjust stock.
**P1-12.** Pilot deployment runbook (`apps/docs/runbooks/pilot-deploy.md`).

**Phase 1 verification:** `pnpm run ci:full && pnpm run e2e:phase1 && pnpm run soak:sync` + checklist in `apps/docs/checklists/phase1.md`.

### Phase 2 — Compliance core

**P2-1.** Certificates with reminders and email/in-app notifications.
**P2-2.** Safety: drill register, work permit lifecycle.
**P2-3.** QHSE: documents, checklists with instant-sign, findings, CAPA.
**P2-4.** Crewing: master records, competency certificates, MLC 2006 validation.
**P2-5.** DNV CG-0339 evidence pack from `JobHistory` immutability + `AuditEvent` log.

**Phase 2 verification:** `pnpm run ci:full && pnpm run e2e:phase2`.

### Phase 3 — Operational depth

**P3-1.** FLGO: tanks, soundings, BDN; IMO DCS / EU MRV / CII reports.
**P3-2.** Project planning (Gantt) for dry-dock and refit.
**P3-3.** Multi-step approval flows by amount and group.
**P3-4.** Supplier RFQ comparison.
**P3-5.** Mobile app feature-parity across all modules.

### Phase 4 — Fleet & integration

**P4-1.** Start (Fleetview) dashboard; budgets vs actuals.
**P4-2.** Integrations: 2BA, Nareto, OCIMF, accounting connector, Microsoft Entra SSO.
**P4-3.** Class-society e-reporting connectors (DNV Veracity, ABS, LR ClassDirect).
**P4-4.** BI: embed Apache Superset.
**P4-5.** Type-approval audit; ISO 27001 readiness review.

### Phase 5 — Hardening & launch

**P5-1.** SMTP-fallback sync hardened and audited.
**P5-2.** Localization (DE / NL / EN / FIL / RU / GR / ZH).
**P5-3.** Performance: fleetview <1.5s on 50 vessels; vessel cold start <5s.
**P5-4.** Pen test (third-party).
**P5-5.** GA launch.

---

## 12. Definition of Done (universal)

A task is done only if **all** are true:

- Code merged to `main` via PR.
- All checks green (lint, typecheck, unit, e2e where applicable, soak where applicable).
- Migrations idempotent and reversible.
- Public API change documented in OpenAPI / proto.
- ADR written for non-trivial architectural choices.
- CLAUDE.md + PROGRESS.md updated (§15 entry, §16 next action, §3/§4 if changed).
- For UI changes: screenshot in PR description.
- For sync-touching changes: `pnpm run soak:sync` run locally.

---

## 13. Forbidden / IP Rules

- Do **not** fetch, screenshot, or scrape marad.com beyond §18 sources.
- Do **not** copy Marad icons, screenshots, color palettes, or marketing copy.
- Do **not** redistribute the SFI dataset. License it or let users import their own.
- Do **not** ingest 2BA / Nareto data without customer-supplied license.
- Do **not** name any class, file, or product "Marad" / "MaraSoft".
- Do **not** add a dependency without recording it in §3.
- Do **not** invent maritime regulation. If a regulation isn't in §8 or §9, ask the human.

---

## 14. Common Pitfalls

- **Workspace package ESM/CJS dual-mode.** `tsconfig.base.json` uses `module: NodeNext` + `verbatimModuleSyntax: true`. Packages consumed by both vitest (ESM) and NestJS (CJS) must be dual-mode: keep `"type":"module"` at root; build script writes `dist/package.json` with `{"type":"commonjs"}`. See `packages/domain/package.json`. Same pattern needed for `sync-engine` and future shared TS packages.
- **Floating-point money.** Use `Prisma.Decimal` / decimal strings. Never `number`.
- **JS `Date` time zones.** Store and serialize UTC ISO 8601 only.
- **SQLite WAL on shutdown.** Electron must call `db.pragma('wal_checkpoint(TRUNCATE)')` before quit.
- **Multi-tenant leakage.** Add Postgres RLS on every tenant-scoped table in the same commit.
- **HLC drift.** Always increment HLC on read of a remote event; never trust `Date.now()` alone.
- **PDF/photo in DB.** Don't. Use S3/MinIO and store the key.
- **Long files.** Split anything trending past 400 lines.
- **Skipping the soak test.** Sync bugs only surface under load + offline windows.
- **Orphan node processes on Windows.** After cancelled dev runs: `Get-NetTCPConnection -LocalPort <port>` → `Stop-Process -Id <OwningProcess>`.

---

## 18. Sources (Marad public material only)

- Marad Brochure (PDF): https://marad.com/wp-content/uploads/2025/12/Marad-Brochure.pdf
- Marad Features: https://marad.com/features/
- Marad Compliance: https://marad.com/compliance/
- Marad Integrations: https://marad.com/integrations/
- Marad App (mobile): https://marad.com/marad-app/
- Marad Cloud: https://marad.cloud/
- MaraSoft Generic API: https://external.marad.ms/index.html
