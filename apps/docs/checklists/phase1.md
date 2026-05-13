# FleetOps Phase 1 — Verification Checklist

> **When to use:** Run this checklist before declaring Phase 1 complete and before any pilot handover.
> Each item maps to an acceptance criterion in `REFERENCE.md §9`.

---

## A. Infrastructure & CI

- [ ] `pnpm run ci:full` passes: lint ✓, typecheck ✓, all unit tests ✓
- [ ] Shore e2e suite passes: `pnpm --filter api-shore run test:e2e`
- [ ] Vessel e2e suite passes: `pnpm --filter api-vessel run test:e2e`
- [ ] Soak test passes: `pnpm run soak:sync` (both Phase 1 + Phase 2)
- [ ] GitHub Actions CI is green on `main`

---

## B. Authentication (P0-10)

- [ ] `POST /auth/login` on shore returns RS256 JWT (24 h access + 30 d refresh)
- [ ] Vessel accepts shore RS256 token offline (no network call)
- [ ] Vessel rejects expired / HS256-confused tokens with 401
- [ ] Vessel local login (HS256) works when issued from vessel directly

---

## C. Maintenance — PMS (P1-1, P1-2)

- [ ] Component hierarchy created (parent → child) and persisted on shore + vessel
- [ ] Job created with `intervalDays` → due date auto-calculated
- [ ] Job created with `intervalRunningHours` → `JobInstance` auto-created when threshold crossed (P1-4)
- [ ] `RunningHourReading` enforces monotonic value; bumps component counter
- [ ] `POST /job-instances/:id/sign-off` with photo:
  - JobHistory row created (immutable — UPDATE/DELETE rejected by DB trigger)
  - JobInstance status → DONE
  - Photo key stored in S3/MinIO (not in DB)
- [ ] Sign-off with `partsConsumedJson` creates `StockMovement` (CONSUMPTION) — P1-10

---

## D. Inventory (P1-5, P1-6)

- [ ] Part created with `partNumber` and `unit`
- [ ] `StockLevel` row configures min/max/reorder per (part × location)
- [ ] `GET /parts/inventory-summary` returns ROB = `SUM(quantity)` per location (no snapshot column)
- [ ] Color status: `green` (ROB ≥ min), `amber` (min > ROB ≥ reorder), `red` (ROB < reorder), `purple` (no StockLevel config)
- [ ] ROB reconstructable by replaying all `StockMovement` rows
- [ ] Cycle-count posts `ADJUSTMENT` movement; ROB changes immediately
- [ ] `GET /barcode-bindings/lookup/:barcode` resolves barcode → part (or 404)

---

## E. Purchase (P1-7, P1-8, P1-9)

- [ ] Requisition lifecycle: DRAFT → SUBMITTED → APPROVED → (PO created)
- [ ] Approval financial limit enforced: €60k requisition blocked for role with €50k limit (403)
- [ ] Rejected requisition (REJECTED) cannot be re-submitted without new draft
- [ ] PO `send` requires `supplierId` (400 without it)
- [ ] Partial GRN: receive 8 of 10 items → PO status `PARTIALLY_RECEIVED`
- [ ] Full GRN: receive remaining 2 → PO status `RECEIVED`
- [ ] `GET /requisitions?status=DRAFT` returns auto-created reorder requisition (from P1-10)

---

## F. Cross-Module: Sign-Off → Inventory → Purchase (P1-10)

- [ ] Sign off job with `partsConsumedJson` containing valid `{ partId, locationId, quantity }` entries
  - CONSUMPTION `StockMovement` created per consumed item
  - ROB drops accordingly
- [ ] If post-consumption ROB ≤ `reorderPoint`:
  - Draft `Requisition` auto-created (not if ROB > reorderPoint)
  - `RequisitionLine.quantity` = `max(reorderPoint - rob, 1)`
- [ ] Backward-compat: sign-off without `partsConsumedJson` (or with old format missing `locationId`) — no movement created, no error

---

## G. Desktop Vessel (Electron) — P1-3b

- [ ] `pnpm --filter desktop-vessel run dev` launches Electron window loading Vite dev server
- [ ] In packaged mode: api-vessel spawns as child process; SPA served from extraResources
- [ ] SQLite WAL checkpoint triggered on app quit (no corrupted DB on Windows kill)
- [ ] NSIS installer builds without error: `pnpm --filter desktop-vessel run dist`

---

## H. Mobile App (Flutter) — P1-11

- [ ] `flutter pub get -C apps/mobile` resolves all dependencies
- [ ] `flutter test apps/mobile` — all 17 tests pass
- [ ] App builds for Android: `flutter build apk -C apps/mobile`
- [ ] Login screen connects to vessel API URL entered by user; token stored in secure storage
- [ ] Job list shows PENDING / IN_PROGRESS instances; DONE items are non-tappable
- [ ] Sign-off: multipart POST with ≥1 photo succeeds; job status → DONE
- [ ] Inventory: parts list with ROB chips loads correctly
- [ ] Barcode scan: `GET /barcode-bindings/lookup/:barcode` resolves to AdjustStockScreen
- [ ] Stock adjustment: `POST /stock-movements` (ADJUSTMENT) accepted; ROB changes visible on refresh

---

## I. Sync (P0-9, P1-2a)

- [ ] gRPC bidi stream established: shore gateway log shows vessel connected
- [ ] Vessel write → outbox → drain → shore: StockMovement appears on shore within 10 s
- [ ] Shore write → vessel: Component created on shore appears on vessel within 10 s
- [ ] Disconnect vessel (kill network): local writes queue in outbox
- [ ] Reconnect: outbox drains; no duplicate rows on shore (LWW / HLC idempotency)
- [ ] `pnpm run soak:sync` Phase 1 scenario PASS (100 ops, offline window, reconnect)

---

## J. Pilot Deployment Runbook

- [ ] `apps/docs/runbooks/pilot-deploy.md` reviewed by at least one person other than the author
- [ ] Shore server deployed following runbook §2–5; seed output saved
- [ ] Vessel workstation deployed following runbook §6–9
- [ ] All smoke-test items in runbook §10 checked off with a witness present
- [ ] Backup cron job configured and tested (§11)

---

## Sign-Off

| Role                      | Name | Date | Signature |
| ------------------------- | ---- | ---- | --------- |
| Lead engineer             |      |      |           |
| QA / reviewer             |      |      |           |
| IT officer (pilot vessel) |      |      |           |

Phase 1 is complete when **all items above are checked** and this table is signed.
