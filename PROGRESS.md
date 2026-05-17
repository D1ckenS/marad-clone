# PROGRESS.md — Progress log + next action

> **This file is read at the start of every session, after REFERENCE.md.** Append to §15 after every task; update §16 immediately after.

---

## 15. Progress Log

> Most-recent first. Format: `### YYYY-MM-DD — <task> — <summary>` then bullets.

### 2026-05-17 — UI — Certificates, Safety, QHSE pages implemented (Bearing design, API-connected)

| Item                                            | Detail                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web-shore/src/pages/CertificatesPage.tsx` | New: 5 tabs — Register (split-pane list + detail with endorsement trail, document card, linked surveys), Surveys (grouped schedule), Conditions of class (severity cards with key-value grid), Inspections (KPI strip + table), Renewal timeline (Gantt-style bars per cert)                                   |
| `apps/web-shore/src/pages/SafetyPage.tsx`       | Rewrite: 5 tabs — Permits to work (split-pane with gas checks, hazards/PPE, isolations, co-signer sign-offs), Findings (KPI strip + table with near-miss/NC/obs/hazard kinds), JHA (library list + 5×5 risk matrix + key controls), Equipment (FFA/LSA/OTH grouped tables), CAPA (Kanban board by stage)       |
| `apps/web-shore/src/pages/QHSEPage.tsx`         | New: 5 tabs — Objectives (category-grouped KPI cards with sparklines), Audits (schedule table + open SMS findings), Environmental (CII band chart + voyage legs + MARPOL discharge log), DryBMS (30-element maturity heatmap with element drilldown), Management review (review cards + upcoming/recent split) |
| `apps/web-shore/src/App.tsx`                    | Replaced ComingSoonPage stubs for /certificates, /safety, /qhse with real pages                                                                                                                                                                                                                                |
| Design pattern                                  | All tabs: Bearing CSS variables, empty states, API-connected (GET endpoints for each entity type), URL-tracked tab param, Spinner loading state                                                                                                                                                                |
| Branch                                          | `feat/phase1-ui-gaps`                                                                                                                                                                                                                                                                                          |

### 2026-05-16 — UI — Purchase page redesigned to match Bearing design

| Item                                                  | Detail                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- | ---- | --------------- | ----------- |
| `apps/web-shore/src/pages/PurchasePage.tsx`           | Complete rewrite: 5 tabs (Requisitions, RFQs, Purchase Orders, Goods Receipts, Suppliers); split-pane PO view with inline detail panel; sub-header with search + New Requisition; footer stats bar (PO count, in-transit, active, open value)                                                                                          |
| `apps/web-shore/src/components/EditSupplierModal.tsx` | New: PATCH /suppliers/:id; edit contact, email, phone, country, address                                                                                                                                                                                                                                                                |
| **Requisitions tab**                                  | Expandable rows showing line items inline; status filter chips; inline submit/approve/reject actions per row                                                                                                                                                                                                                           |
| **RFQs tab**                                          | Left rail (RFQ list, 300px) + right quote comparison grid; columns = suppliers, rows = Total / Notes / Valid Until; LOWEST auto-badge; Award & convert → POST /quotes/:id/accept                                                                                                                                                       |
| **Purchase Orders tab**                               | Left: stage filter chips (All → Draft → Sent → Confirmed → In Transit → Partial → Received → Closed) + scrollable list; Right: 400px detail pane with 7-step lifecycle stepper (dots + connector bars, green=done/navy=current), money tiles, lines with RECEIVED/PARTIAL/OPEN pills, receipt history, inline GRN form when receivable |
| **Goods Receipts tab**                                | Fetches received POs, flattens their `receipts[]` arrays; columns: GRN                                                                                                                                                                                                                                                                 | Against PO | Supplier | Date | Receipt (badge) | Discrepancy |
| **Suppliers tab**                                     | Unchanged functionality; edit + delete on row hover                                                                                                                                                                                                                                                                                    |
| Branch                                                | `feat/phase1-ui-gaps` (PR #21 open)                                                                                                                                                                                                                                                                                                    |

### 2026-05-16 — UI — Inventory page redesigned to match Bearing 3-pane design

| Item                                         | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web-shore/src/pages/InventoryPage.tsx` | Complete rewrite: 3-pane layout — 200px location rail (from GET /stock-locations with per-location counts + status legend) · scrollable center table (status dot, part code, description, location, ROB colored by status, unit, min, reorder, max; both-axis scroll with always-visible scrollbars) · 300px detail pane (stock bar with red/amber/green zones + ROB needle marker, per-location breakdown, movement ledger from GET /stock-movements?partId=, Post movement / Stock config / Barcodes action buttons) |
| Branch                                       | `feat/phase1-ui-gaps` (PR #21 open)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### 2026-05-16 — UI — Bearing design system + complete Phase 1 UI

Large batch of UI work implementing the Bearing design system across all Phase 1 screens (previously in PR #20 `feat/bearing-design`).

| Item                                                      | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/ui-kit/src/AppShell.tsx`                        | Bearing sidebar: BearingMark SVG (eccentric ring), ModBadge 3-state (active=navy/inactive=dim/idle=surface-2), Initials avatar (navy circle), anyActive dimming logic                                                                                                                                                                                                                                                                                  |
| `packages/ui-kit/src/Badge.tsx`                           | Six signal colors: green/amber/red/purple/blue/slate with Bearing bg+fg values                                                                                                                                                                                                                                                                                                                                                                         |
| `packages/ui-kit/src/Button.tsx`                          | Navy primary, warm secondary, danger red, ghost; sm/md/lg sizes; loading spinner                                                                                                                                                                                                                                                                                                                                                                       |
| `packages/ui-kit/src/Modal.tsx`                           | Navy tint backdrop, 2px blur, hairline dividers, lg/sm sizes                                                                                                                                                                                                                                                                                                                                                                                           |
| `packages/ui-kit/src/Input.tsx`                           | Navy focus ring `0 0 0 3px rgba(10,31,51,.08)`                                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/web-shore/src/globals.css`                          | Full Bearing CSS variable set (bg/surface/surface-2/ink/navy/signal palette)                                                                                                                                                                                                                                                                                                                                                                           |
| `apps/web-shore/tailwind.config.ts`                       | Bearing tokens as Tailwind utilities (bg-navy, text-ink-2, border-hairline, rounded-1/2/3/4, signal colors)                                                                                                                                                                                                                                                                                                                                            |
| `apps/web-shore/index.html`                               | Geist + Geist Mono fonts via Google Fonts                                                                                                                                                                                                                                                                                                                                                                                                              |
| `apps/web-shore/vite.config.ts`                           | Port moved to 5342 (5173 blocked by Windows Hyper-V exclusion range 5141–5240)                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/web-shore/src/App.tsx`                              | 9 nav modules: Start, Maintenance, Inventory, Purchase, Certificates, Safety, QHSE, Crewing, FLGO; /jobs → /components?tab=jobs redirect                                                                                                                                                                                                                                                                                                               |
| `apps/web-shore/src/pages/DashboardPage.tsx`              | Greeting by time of day, 5 KPI tiles, two-column worklist (open jobs + requisitions), live API data                                                                                                                                                                                                                                                                                                                                                    |
| `apps/web-shore/src/pages/ComponentsPage.tsx`             | Maintenance module with 6 tabs driven by ?tab= URL param: Components · Jobs (JobInstancesPage inline) · History · Templates · Running Hours · Projects                                                                                                                                                                                                                                                                                                 |
| `apps/web-shore/src/pages/MaintenanceHistoryTab.tsx`      | Immutable JobHistory records; 🔒 lock badge; DNV CG-0339 footer note                                                                                                                                                                                                                                                                                                                                                                                   |
| `apps/web-shore/src/pages/MaintenanceTemplatesTab.tsx`    | Job template library; RH/CAL/RH+CAL interval badges; + Instance / Edit actions                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/web-shore/src/pages/MaintenanceRunningHoursTab.tsx` | Running hours per component; progress bar (navy→amber@90%→red overdue); OVERDUE pill; inline LogRunningHoursModal                                                                                                                                                                                                                                                                                                                                      |
| `apps/web-shore/src/pages/ComingSoonPage.tsx`             | Stub for Phase 2/3 modules                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **New modals**                                            | CreateComponentModal, EditComponentModal, CreateJobModal (with TypicalPartsList BOM editor), EditJobModal, CreateJobInstanceModal, LogRunningHoursModal, CreatePartModal, EditPartModal, AddStockLevelModal, PostStockMovementModal, ManageBarcodesModal, CreateRequisitionModal (rewritten with inline line items), CreatePurchaseOrderModal, CreateSupplierModal, EditSupplierModal, SignOffModal (rewritten with parts picker + BOM pre-population) |
| **Schema additions**                                      | `typicalPartsJson TEXT` on jobs table (both shore Prisma + vessel Drizzle); migration applied                                                                                                                                                                                                                                                                                                                                                          |
| **Barcode bindings GET**                                  | Added `GET /barcode-bindings?partId=` on both shore + vessel controllers                                                                                                                                                                                                                                                                                                                                                                               |
| Branch                                                    | PR #20 merged to main                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Key design decisions:**

- Tab state in URL (`?tab=`) for Maintenance and Purchase — survives refresh, linkable
- ModBadge 3-state: active (navy), inactive-when-any-active (transparent+ink-3), all-idle (surface-2+hairline)
- Jobs folded into Maintenance as second tab — no standalone /jobs nav item
- TypicalPartsList shared BOM editor used in CreateJobModal + EditJobModal + SignOffModal pre-population

### 2026-05-13 — P1-11 — Mobile app (Flutter)

| Item                                               | Detail                                                                                                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/pubspec.yaml`                         | Flutter 3.22+ app; deps: `http ^1.2.1`, `flutter_secure_storage ^9.0.0`, `mobile_scanner ^5.2.3`, `image_picker ^1.1.2`, `provider ^6.1.2`                                                     |
| `apps/mobile/lib/utils/jwt.dart`                   | `decodeJwtPayload()` — base64url-decodes JWT payload without signature verification (client-side claim read only)                                                                              |
| `apps/mobile/lib/services/api_client.dart`         | `ApiClient` — `get`, `post`, `postMultipart`; throws `ApiException` on non-2xx; token injection via `setToken()`                                                                               |
| `apps/mobile/lib/providers/auth_provider.dart`     | `AuthProvider` (`ChangeNotifier`) — `login()` → `POST /auth/login` → token stored in `flutter_secure_storage`; `init()` restores token + base URL on startup; JWT claims extracted client-side |
| `apps/mobile/lib/models/job_instance.dart`         | `JobModel.fromJson`, `JobInstance.fromJson` with `isDone / isPending / isInProgress` helpers                                                                                                   |
| `apps/mobile/lib/models/inventory_item.dart`       | `InventoryItem.fromJson` (maps `stockLevels[]` from inventory-summary API); `overallStatus` propagates worst status (red > amber > purple > green)                                             |
| `apps/mobile/lib/screens/login_screen.dart`        | Login form: tenantId, email, password, expandable vessel API URL field                                                                                                                         |
| `apps/mobile/lib/screens/home_screen.dart`         | `IndexedStack` TabBar — Jobs + Inventory; sign-out with confirmation dialog                                                                                                                    |
| `apps/mobile/lib/screens/jobs_screen.dart`         | Fetches `GET /job-instances` + `GET /jobs` in parallel; joined client-side; tap → `SignOffScreen`                                                                                              |
| `apps/mobile/lib/screens/sign_off_screen.dart`     | `POST /job-instances/:id/sign-off` multipart; camera + gallery photo picker; hoursWorked / notes / signatureHash fields                                                                        |
| `apps/mobile/lib/screens/inventory_screen.dart`    | `GET /parts/inventory-summary`; ROB chips per location; FAB → barcode scan; tap → `AdjustStockScreen`                                                                                          |
| `apps/mobile/lib/screens/barcode_scan_screen.dart` | `MobileScanner` widget; on detect → `GET /barcode-bindings/lookup/:barcode`; returns `BarcodeScanResult` to caller                                                                             |
| `apps/mobile/lib/screens/adjust_stock_screen.dart` | `POST /stock-movements` (ADJUSTMENT / RECEIPT / CONSUMPTION); fetches `GET /stock-locations` for dropdown when no locationId pre-supplied                                                      |
| `apps/mobile/lib/widgets/job_status_badge.dart`    | Colored badge for PENDING / IN_PROGRESS / DONE                                                                                                                                                 |
| `apps/mobile/lib/widgets/rob_status_chip.dart`     | Icon-based chip for green / amber / red / purple ROB status                                                                                                                                    |
| `apps/mobile/test/models_test.dart`                | 12 unit tests: `JobInstance`, `JobModel`, `InventoryItem`, `StockLevelEntry` fromJson parsing and business logic                                                                               |
| `apps/mobile/test/jwt_decode_test.dart`            | 5 unit tests: claim extraction, missing claims, format errors                                                                                                                                  |
| CI                                                 | Flutter SDK not installed in this environment — `flutter test` must be run locally. Dart SDK 3.11.5 present.                                                                                   |

**Key design decisions:**

- `AuthProvider.init()` is called before `runApp` so the first frame shows the correct screen (no login flash)
- Token + base URL both persisted in `flutter_secure_storage` — survives app restart without re-login
- Barcode lookup returns flat `{ partId, partName, partNumber }` — used directly in `AdjustStockScreen`
- `AdjustStockScreen` fetches `GET /stock-locations` lazily when no locationId is pre-supplied (barcode scan flow); pre-supplied locationId (from inventory list tap) skips the fetch
- `ADJUSTMENT` quantity is signed (positive = add, negative = remove) — labelled in the form helper text
- `IndexedStack` keeps both tabs alive so their scroll position is preserved across tab switches

### 2026-05-13 — P1-12 — Pilot deployment runbook + Phase 1 checklist

| Item                                 | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/docs/runbooks/pilot-deploy.md` | 13-section runbook covering: prerequisites (shore server + vessel workstation specs), Docker Compose infra, MinIO bucket creation, JWT keypair generation, shore .env config, Prisma migrate deploy, systemd service, seed script, Electron installer build + distribution, vessel .env config, SQLite migration, gRPC sync enable + verify, 6-section smoke-test checklist (auth / PMS / inventory / purchase / barcode / sync), day-2 ops (logs, backups, upgrade, photo lifecycle), adding a second vessel, rollback procedure |
| `apps/docs/checklists/phase1.md`     | Phase 1 verification checklist with 10 sections (A–J): CI, auth, PMS, inventory, purchase, cross-module P1-10, Electron, mobile, sync, runbook sign-off; sign-off table for lead engineer + QA + IT officer                                                                                                                                                                                                                                                                                                                       |

**Key design decisions:**

- Runbook targets a systemd service for shore (not Docker for api-shore itself) — keeps the production setup simpler and avoids nested Docker complexity
- `VESSEL_LOCAL_JWT_SECRET` explicitly called out as per-vessel (not shared across fleet)
- Smoke tests written as step-by-step with concrete values (e.g. exact ROB thresholds) so a non-developer can execute them
- Backup commands are copy-paste-ready (cron syntax for shore Postgres, PowerShell for vessel SQLite)

### 2026-05-13 — P1-10 — Cross-module: job sign-off → StockMovement → reorder Requisition

| Item                                                     | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api-shore/src/job-history/job-history.service.ts`  | Added `PartConsumed` interface + `extractValidConsumed()` helper; P1-10 block inside the `withTenant` tx: (1) creates a CONSUMPTION `StockMovement` per consumed item, referencing the JobHistory; (2) deduplicates (partId, locationId) pairs; (3) checks post-movement ROB via `$queryRaw` SUM; (4) if ROB ≤ `StockLevel.reorderPoint`, auto-creates a draft `Requisition` + `RequisitionLine`; return shape unchanged (backward compat) |
| `apps/api-vessel/src/job-history/job-history.service.ts` | Mirror of shore but Drizzle/sync: added `stockMovements, stockLevels, requisitions, requisitionLines, parts` imports; same helper + P1-10 block inside `db.transaction()`; uses `parseFloat()` for Decimal comparison                                                                                                                                                                                                                      |
| `apps/api-shore/test/sign-off-cross-module.e2e.ts`       | 5 e2e tests: no partsConsumed → no movement; old-format (missing locationId/quantity) → backward-compat skip; valid format → CONSUMPTION movement with negated qty; ROB 14 > reorder 10 → no requisition; ROB 8 ≤ reorder 10 → draft Requisition with line qty=2 (deficit)                                                                                                                                                                 |
| `apps/api-vessel/test/sign-off-cross-module.e2e.ts`      | 4 e2e tests: same coverage on SQLite                                                                                                                                                                                                                                                                                                                                                                                                       |
| `packages/domain/src/running-hour-scheduler.test.ts`     | Added 15 000 ms per-test timeout to all 5 property-based tests (numRuns=500 each) that were consistently hitting the 5 000 ms default under CI load                                                                                                                                                                                                                                                                                        |
| CI                                                       | `pnpm run lint` ✓; `pnpm run typecheck` ✓; 139 ✓ unit; shore e2e → 100 ✓ (11 files); vessel e2e → 80 ✓ (10 files)                                                                                                                                                                                                                                                                                                                          |

**Key design decisions:**

- `extractValidConsumed` uses duck-typing: items missing `locationId` or `quantity` (the old free-form format) are silently skipped — ensures backward compat with the P1-2 sign-off test
- Movements and reorder check happen inside the same `withTenant` / `db.transaction` as the JobHistory insert — fully atomic; if the requisition create fails, no orphan movements are committed
- Return value of `signOff()` is unchanged (still the `JobHistory` record) — the suggested Requisition is created silently; UI discovers it via `GET /requisitions?status=DRAFT`
- Deficit qty = `max(reorderPoint - rob, 1)` so the requisition line is never zero-quantity

### 2026-05-13 — P1-9 — Purchase UI (web-shore)

| Item                                                       | Detail                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web-shore/src/pages/PurchasePage.tsx`                | Two-tab page (Requisitions / Purchase Orders); `RequisitionsTab` with ALL/DRAFT/SUBMITTED/APPROVED/REJECTED filter, inline Submit/Approve/Reject actions per row; `PurchaseOrdersTab` with ALL/DRAFT/SENT/IN_TRANSIT/PARTIALLY_RECEIVED/RECEIVED filter, inline Send action, click-row to detail |
| `apps/web-shore/src/components/CreateRequisitionModal.tsx` | Form modal: title (required), notes, totalAmount, currency; `POST /requisitions`; resets on close                                                                                                                                                                                                |
| `apps/web-shore/src/components/RejectRequisitionModal.tsx` | Reject modal with optional reason textarea; `POST /requisitions/:id/reject`                                                                                                                                                                                                                      |
| `apps/web-shore/src/components/PODetailModal.tsx`          | PO detail: header grid (status badge, supplier, total, PO#, expected delivery, notes); order lines table; receipt history; inline `GrnSection` for receivable POs with per-line qty inputs + `POST /purchase-orders/:id/receive`                                                                 |
| `apps/web-shore/src/App.tsx`                               | Added `🛒 Purchase` nav link at `/purchase`; changed Jobs icon to `🗂️` to free `📋`; added `<Route path="purchase">`                                                                                                                                                                             |
| CI                                                         | `pnpm run lint` ✓; `pnpm run typecheck` ✓; `pnpm --filter web-shore exec tsc --noEmit` ✓; 139 ✓ unit tests                                                                                                                                                                                       |

**Key design decisions:**

- Types defined in `PurchasePage.tsx` (exported for sibling tabs) and re-declared locally in `PODetailModal.tsx` to avoid circular imports
- `useCallback` + `useEffect([load])` pattern for re-fetchable data with filter dependency
- GRN entry is an inline section inside `PODetailModal` (no nested modal), only rendered when `canReceive(po.status) && po.lines.length > 0`
- `stopPropagation` on action-column cells prevents row-click from opening the detail modal when clicking Send/Receive buttons

### 2026-05-13 — P1-8 — Purchase API (Requisition + approval + PO + GRN)

| Item                                                                                | Detail                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api-shore/src/{supplier,approval-flow,requisition,rfq,quote,purchase-order}/` | 6 NestJS modules (controller + service + DTOs + module) for all purchase entities; tenant-scoped modules skip OutboxRecorder; vessel-scoped modules use OutboxRecorder |
| `apps/api-vessel/src/`                                                              | Mirror of all 6 modules using Drizzle/SQLite patterns                                                                                                                  |
| `POST /requisitions/:id/submit`                                                     | DRAFT → SUBMITTED                                                                                                                                                      |
| `POST /requisitions/:id/approve`                                                    | SUBMITTED → APPROVED; enforces `ApprovalStep.limitAmount` per role (403 if over limit)                                                                                 |
| `POST /requisitions/:id/reject`                                                     | SUBMITTED → REJECTED with optional reason                                                                                                                              |
| `POST /purchase-orders/:id/send`                                                    | DRAFT → SENT; requires `supplierId` (400 otherwise)                                                                                                                    |
| `POST /purchase-orders/:id/receive`                                                 | Creates `GoodsReceipt` + `GoodsReceiptLine` records; sets PO → `PARTIALLY_RECEIVED` or `RECEIVED` based on totals across all receipts                                  |
| `apps/api-shore/test/purchase-api.e2e.ts`                                           | 8 HTTP e2e tests covering all key acceptance criteria                                                                                                                  |
| `apps/api-vessel/test/purchase-api.e2e.ts`                                          | 5 HTTP e2e tests covering same on SQLite                                                                                                                               |
| CI                                                                                  | `pnpm run ci:full` → 139 ✓ unit; shore e2e → 95 ✓ (10 files); vessel e2e → 76 ✓ (9 files); lint/typecheck/format clean                                                 |

**Key design decisions:**

- `Supplier`, `ApprovalFlow`, `ApprovalStep` services have no OutboxRecorder (tenant-scoped only)
- Approval limit comparison uses `Prisma.Decimal.greaterThan` (shore) and `parseFloat` (vessel)
- GRN partial check: sums all receipts across all `GoodsReceiptLine` rows matching each PO line
- PO `send` validates supplierId presence at application layer (mirrors the DB CHECK constraint)

### 2026-05-13 — P1-7 — Purchase schema (Requisition → GoodsReceipt)

| Item                                                                   | Detail                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api-shore/prisma/schema.prisma`                                  | 4 new enums (`RequisitionStatus`, `PurchaseOrderStatus`, `RfqStatus`, `QuoteStatus`) + 12 new models: `Supplier`, `ApprovalFlow`, `ApprovalStep`, `Requisition`, `RequisitionLine`, `Rfq`, `Quote`, `QuoteLine`, `PurchaseOrder`, `POLine`, `GoodsReceipt`, `GoodsReceiptLine`; relations added to `Tenant` + `Vessel` + `Part` |
| `apps/api-shore/prisma/migrations/20260512205903_add_purchase_schema/` | Prisma-generated migration; hand-appended CHECK constraints (`requisitions_approved_requires_approver_chk`, `purchase_orders_non_draft_requires_supplier_chk`) + RLS tenant-isolation policies on all 12 tables                                                                                                                 |
| `apps/api-vessel/src/db/schema.ts`                                     | Mirror of all 12 purchase tables in Drizzle/SQLite; 4 new status const arrays; same CHECK constraints via Drizzle `check()`                                                                                                                                                                                                     |
| `apps/api-vessel/drizzle/0004_wise_venus.sql`                          | Drizzle-generated migration; applied via `drizzle-kit migrate`                                                                                                                                                                                                                                                                  |
| `apps/api-shore/test/purchase-schema.e2e.ts`                           | 8 e2e tests: Supplier round-trip, ApprovalFlow+Step, duplicate step constraint, Requisition+Lines, CHECK approved_requires_approver, CHECK PO non-draft requires supplier, full procurement chain, RLS policy presence                                                                                                          |
| `apps/api-vessel/test/purchase-schema.e2e.ts`                          | 6 e2e tests: same coverage on SQLite                                                                                                                                                                                                                                                                                            |
| CI                                                                     | `pnpm run ci:full` → 139 ✓ unit; shore e2e → 87 ✓ (9 files); vessel e2e → 71 ✓ (8 files); lint/typecheck/format clean                                                                                                                                                                                                           |

**Key design decisions:**

- `Supplier`, `ApprovalFlow`, `ApprovalStep` are **tenant-scoped only** (no `vessel_id`) — fleet-wide catalogs replicated shore→vessel
- `ApprovalStep.limitAmount` = max amount the role can approve; `null` = no limit
- Requisition CHECK: `status != 'APPROVED' OR approved_by_user_id IS NOT NULL` (Postgres + SQLite)
- PurchaseOrder CHECK: `status = 'DRAFT' OR supplier_id IS NOT NULL` — supplier required before leaving DRAFT
- `GoodsReceiptLine` enables partial GRN receipts (`quantityOrdered` vs `quantityReceived`)
- `POLine.quoteLineId` is a soft FK (traceability only)

### 2026-05-12 — P1-6 — Inventory API + UI

| Item                                                                                                 | Detail                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api-shore/src/{part-category,part,stock-location,stock-level,stock-movement,barcode-binding}/` | 6 NestJS modules (controller + service + DTOs + module) for all inventory entities; tenant-scoped entities skip OutboxRecorder (same pattern as MasterComponent)           |
| `apps/api-vessel/src/`                                                                               | Mirror of all 6 modules using Drizzle/SQLite patterns                                                                                                                      |
| `GET /parts/inventory-summary`                                                                       | Single-call endpoint returning all parts enriched with per-location ROB (computed via `SUM(quantity)`) and color status (`green/amber/red/purple`); available on both apps |
| `GET /stock-movements/rob`                                                                           | Raw ROB aggregation endpoint per `(partId, locationId)`                                                                                                                    |
| `GET /barcode-bindings/lookup/:barcode`                                                              | Resolves barcode → part (for mobile scan)                                                                                                                                  |
| `apps/web-shore/src/pages/InventoryPage.tsx`                                                         | Parts list with color-status chips, filter buttons (All / Low+Reorder / Out), per-location ROB                                                                             |
| `apps/web-shore/src/App.tsx`                                                                         | Added `📦 Inventory` nav link at `/inventory`                                                                                                                              |
| `apps/api-shore/test/inventory-api.e2e.ts`                                                           | 14 e2e tests: full CRUD chain + ROB verification + color status + barcode lookup                                                                                           |
| `apps/api-vessel/test/inventory-api.e2e.ts`                                                          | 11 e2e tests: same coverage on vessel                                                                                                                                      |
| CI                                                                                                   | `pnpm run ci:full` → 139 ✓ unit tests; shore e2e → 79 ✓ (8 files); vessel e2e → 65 ✓ (7 files); lint/typecheck/format clean                                                |

### 2026-05-12 — P1-5 — Inventory schema

| Item                                                                    | Detail                                                                                                                                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api-shore/prisma/schema.prisma`                                   | `StockMovementType` enum + 6 new models: `PartCategory`, `Part`, `StockLocation`, `StockLevel`, `StockMovement`, `BarcodeBinding`; relations added to `Tenant` + `Vessel` |
| `apps/api-shore/prisma/migrations/20260512173641_add_inventory_schema/` | Auto-generated Prisma migration (tables, indexes, FKs) + hand-appended RLS policies for all 6 tables (same shape as maintenance migration)                                |
| `apps/api-vessel/src/db/schema.ts`                                      | Same 6 tables in Drizzle/SQLite; `STOCK_MOVEMENT_TYPES` as TS const array; `PartCategory.parentId` is a soft FK (no SQLite circular FK)                                   |
| `apps/api-vessel/drizzle/0003_small_ultron.sql`                         | Drizzle-generated migration; applied via `drizzle-kit migrate`                                                                                                            |
| `apps/api-shore/test/inventory-schema.e2e.ts`                           | 7 e2e tests: category hierarchy, part CRUD, StockLevel unique constraint, ROB-by-SUM, barcode uniqueness, RLS policy verification                                         |
| `apps/api-vessel/test/inventory-schema.e2e.ts`                          | 6 e2e tests: same coverage on SQLite                                                                                                                                      |
| CI                                                                      | `pnpm run ci:full` → 139 ✓ unit tests; shore e2e → 65 ✓; vessel e2e → 53 ✓; lint/typecheck/format clean                                                                   |

**Key design decisions:**

- `quantity` in `StockMovement` is **signed** (+ = stock in, − = stock out). ROB = `SUM(quantity)` per (vessel, part, location). No snapshot column.
- `PartCategory` and `Part` are **tenant-scoped only** (no `vessel_id`) — fleet-wide catalog replicated shore→vessel.
- `BarcodeBinding` has a unique constraint on `(tenant_id, barcode)` — one barcode maps to one part per fleet.
- `StockLevel` unique on `(tenant_id, vessel_id, part_id, location_id)` — one config row per part×location.

### 2026-05-12 — P1-4 — Running-hour scheduling logic

| Item                                                 | Detail                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain/src/running-hour-scheduler.ts`      | Pure `checkRunningHourThresholds(input)` — returns all interval thresholds crossed by a reading update                                      |
| `packages/domain/src/running-hour-scheduler.test.ts` | 12 unit tests + 7 property-based tests (fast-check, 500 runs each): count, multiples, bounds, sort, purity                                  |
| `packages/domain/src/index.ts`                       | Re-exports `checkRunningHourThresholds` + `RunHourCheckInput`                                                                               |
| `apps/api-shore/…/running-hour-reading.service.ts`   | After bumping component runningHours, queries RH-interval jobs, calls scheduler, creates `JobInstance` per threshold with idempotency guard |
| `apps/api-vessel/…/running-hour-reading.service.ts`  | Same on Drizzle/SQLite; `isNotNull` + `jobs`/`jobInstances` added to imports                                                                |
| e2e — both apps                                      | +3 tests each: boundary crossing auto-creates instance; no dupe in same interval; second boundary creates second instance                   |
| CI                                                   | `pnpm run ci:full` → 139 ✓ tests (+19), lint clean, typecheck clean, format clean                                                           |

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

**UI modules complete.** PR #21 (`feat/phase1-ui-gaps`) now includes Certificates (5 tabs), Safety (5 tabs, rewrite), and QHSE (5 tabs). FLGO is not yet designed — still shows ComingSoonPage stub.

Next: **Phase 1 verification** — run `pnpm run ci:full && pnpm run e2e:phase1 && pnpm run soak:sync` and work through `apps/docs/checklists/phase1.md`. After all checklist items are green, begin **P2-1 — Certificates backend** (schema, API, expiry alerts, email/in-app notifications).

**Outstanding follow-up tickets (deferred, not blocking P1-4):**

- **P0-10 follow-up: real OIDC.** Add `openid-client@5.x`, implement `OidcService.beginLogin/completeLogin` for Microsoft Entra.
- **P0-10 follow-up: cross-app offline-token e2e.** Boot both apps in one test, login via shore, deliver token via sync, verify offline, write, sync back.
- **P1-2 follow-up: photo-byte sync vessel↔shore.** Only S3 keys traverse the wire today. Deferred to P5.
- **P1-2 follow-up: master library replication shore→vessel.** Vessel `master_components` is read-only and empty until a broadcast mechanism lands.
- **P1-3b follow-up: api-vessel WAL checkpoint.** Add `app.enableShutdownHooks()` + `OnApplicationShutdown` with `PRAGMA wal_checkpoint(TRUNCATE)`.
- **P1-3b follow-up: CI Electron binary.** Add `ELECTRON_SKIP_BINARY_DOWNLOAD=1` to `.github/workflows/ci.yml` if binary download slows CI.
