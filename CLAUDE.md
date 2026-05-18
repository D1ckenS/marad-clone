# CLAUDE.md — MARAD-Equivalent Maritime Fleet Management System

> **Entry point for every Claude Code session.** Read this file first, then the two companion files below, then act.

---

## 0. START HERE — Resume Protocol

Do these steps **in order**. Do not skip any.

1. **Read this entire file.**
2. **Read `REFERENCE.md`** — stable reference (tech stack, conventions, module specs, build phases).
3. **Read `PROGRESS.md`** — progress log (§15) and next action (§16).
4. **Run `git status` and `git log --oneline -20`.** Confirm repo state matches the last entry in PROGRESS.md §15. If it does not, treat the repo as truth and update PROGRESS.md §15 before doing anything else.
5. **Restate the next action** (PROGRESS.md §16) in one sentence so the human can correct you if it is stale.

When you finish a task:
- Append a dated entry to PROGRESS.md §15.
- Update PROGRESS.md §16 to the next task.
- Run the phase verification command (listed in REFERENCE.md §11).
- Commit using Conventional Commits (REFERENCE.md §10).

If uncertain, **stop and ask** rather than guess.

---

## File Index

| File | Purpose | Read order |
|---|---|---|
| `CLAUDE.md` | Entry point + resume protocol | 1st |
| `REFERENCE.md` | Tech stack, conventions, module specs, build phases | 2nd |
| `PROGRESS.md` | Progress log + next action | 3rd |

---

## 17. Open Questions for the Human

Decisions only Ziad can make. Ask before acting.

- [x] **Production product name.** Decided: **FleetOps**. Trademark check still required before public release (Phase 4).
- [ ] **First pilot vessel.** Which ship, when, offline-window expectations.
- [ ] **Class society for initial type-approval.** DNV (most common for Marad), or another?
- [ ] **Hosting target for shore.** AWS / Azure / on-prem / customer-private-cloud?
- [ ] **Accounting integration target.** SAP / Exact / Twinfield / NetSuite / other?
- [ ] **Initial languages besides English.** Likely Dutch; confirm.
- [ ] **2BA / Nareto licensing.** Direct license, or skip until a customer asks?

---

## 18. Platform Super-Admin Setup

The platform super-admin (Ziad) has **no company assignment** — `tenant_id IS NULL` in the database.

### Creating / resetting the super-admin account

1. Add `PLATFORM_BOOTSTRAP_KEY=<secret>` to `apps/api-shore/.env` and restart the server.
2. In PowerShell:
```powershell
$body = @{ bootstrapKey = "<secret>"; email = "<email>"; password = "<password>" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/bootstrap-super-admin" -Method POST -ContentType "application/json" -Body $body
```
3. Returns 201 on first creation, 409 if email already exists.

### Resetting the password (if locked out)

```powershell
# 1. Generate hash (run from apps/api-shore/)
cd apps/api-shore
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('NewPassword', 12).then(h => console.log(h))"
cd ../..

# 2. Write hash to DB
docker exec infra-postgres-1 psql -U fleetops -d fleetops_shore -c "UPDATE users SET password_hash = '<hash>' WHERE email = '<email>' AND role = 'SUPER_ADMIN';"
```

### Logging in

At `http://localhost:5342` click **"Platform admin login"** (bottom of the login form) — this hides the Organisation ID field. Email + password only.

### What super-admin can do

- **Companies page** (`/companies`) — create, rename, view all companies with vessel/user counts.
- Cannot access vessel modules (Maintenance, Inventory, etc.) — those are company-scoped.

### Known test-data pollution

The e2e test suite creates throwaway tenants (`Demo Shipping Co.`, `purchase-api-test`, etc.) on every run against the dev database. They appear in the Companies list. Clean them up with:

```powershell
docker exec infra-postgres-1 psql -U fleetops -d fleetops_shore -c "DELETE FROM tenants WHERE name IN ('Demo Shipping Co.', 'purchase-api-test') OR name LIKE '%-api-%' OR name LIKE '%-test%';"
```

Or delete individual companies by ID via the API:
```powershell
# Not yet implemented — add DELETE /tenants/:id when needed (Phase 4).
```

---

## 19. Companion Document

`MARAD-equivalent-build-plan.docx` (same folder) is the stakeholder-facing version. It is informational and not maintained alongside code. **This `CLAUDE.md` (+ companion files) is the source of truth for execution.**

---

## 20. Design System Reference — Bearing

The visual design is defined in a Claude Design bundle. The active bundle URL is:

```
https://api.anthropic.com/v1/design/h/Vwl6rDO7MhqrUlpJ_TFuCA
```

This URL returns a gzip-compressed tar archive. To extract in a fresh session:

```bash
# Fetch and extract
curl -L "https://api.anthropic.com/v1/design/h/Vwl6rDO7MhqrUlpJ_TFuCA" -o bearing.tar.gz
mkdir -p bearing-extract && tar -xf bearing.tar.gz -C bearing-extract
```

**Contents:**

| File | What it defines |
|---|---|
| `marad-clone/project/src/tokens.css` | All Bearing design tokens (colors, type scale, radii, shadows) |
| `marad-clone/project/src/primitives.jsx` | Shared atoms: `T` color map, `Pill`, `Btn`, `ModBadge`, `Glyph.*`, `BearingMark` |
| `marad-clone/project/src/screen-shoreside.jsx` | Shore web — Dashboard (Fleetview), fleet KPI strip, vessel table, activity feed |
| `marad-clone/project/src/screen-onboard.jsx` | Onboard Electron — vessel banner, running-hours strip, watch panel |
| `marad-clone/project/src/screen-mobile.jsx` | Mobile (iPhone) — greeting, hot-work banner, quick actions |
| `marad-clone/project/src/screen-inventory.jsx` | Inventory module — 3-pane: location rail + scrollable column table + detail pane |
| `marad-clone/project/src/screen-purchase.jsx` | Purchase module — 4 tabs: Requisitions, RFQs (quote comparison), POs (lifecycle stepper), GRNs |
| `marad-clone/project/src/screen-maintenance.jsx` | Maintenance — 6 tabs: Components, Jobs, History, Templates, Running Hours, Projects (Gantt) |
| `marad-clone/project/src/screen-crewing.jsx` | Crewing — 5 tabs: Crew, Rotation, Rest Hours, Certificates, Drills |
| `marad-clone/chats/chat1.md` | Full design chat transcript — read this first to understand intent before implementing |

**Bearing palette (already in `packages/ui-kit` and `globals.css`):**

| Token | Value | Use |
|---|---|---|
| `--navy` / `--ink` | `#0A1F33` | Primary text, active UI |
| `--bg` | `#FAFAF7` | Page background |
| `--surface` | `#FFFFFF` | Card / panel |
| `--surface-2` | `#F4F2EC` | Table headers, secondary areas |
| `--surface-sunk` | `#EFEDE6` | Selected row, sunk insets |
| `--hairline` | `#EEEBE2` | Row dividers |
| `--border` | `#E5E3DA` | Card borders |
| `--sig-green` | `#2F7D4F` | Good / received |
| `--sig-amber` | `#B5731E` | Warning / in transit |
| `--sig-red` | `#AB382E` | Overdue / cancelled |
| `--sig-blue` | `#1F5B9D` | Informational / sent |

---

## 22. Session Pre-Flight Protocol

Run these **before writing any code** at the start of a task session. Failures here are pre-existing regressions — fix or document them before starting new work, so they don't get mixed up with your own changes.

```powershell
# 1. Full CI (lint + typecheck + unit tests + format)
pnpm -w run ci:full

# 2. Shore e2e
pnpm --filter api-shore run test:e2e

# 3. Vessel e2e
pnpm --filter api-vessel run test:e2e
```

**Why:** In Phase 2, the P2-2 merge changed `POST /auth/login` to require `identifier:` and added `username` as a required field, but 8 shore e2e test files were never updated. This was only caught after implementing P2-3 and running the suite — causing a 20-minute detour to diagnose, revert a failed regex fix, and apply targeted edits. A pre-flight run at session start surfaces this in 30 seconds.

---

## 23. Prisma Migration — RLS / Extra SQL Pattern

**Problem:** After `prisma migrate dev` applies a migration, the file in `prisma/migrations/` has a known checksum stored in `_prisma_migrations`. If you then append RLS policies or other SQL to that file, the next `prisma migrate dev` detects a checksum mismatch and aborts.

**Fix pattern (use every time):**

```powershell
# Step 1 — generate the migration SQL without applying it
pnpm --filter api-shore prisma migrate dev --name <name> --create-only

# Step 2 — append RLS + any extra SQL to the generated file BEFORE applying
# (edit the migration.sql now)

# Step 3 — apply
pnpm --filter api-shore prisma migrate dev --name <name>
# Prisma will detect the existing file and apply it without re-generating.
```

> **If you already applied and then edited the file**, compute the correct checksum and update `_prisma_migrations`:
> ```powershell
> # Compute new checksum
> node -e "const c=require('crypto'),fs=require('fs'); console.log(c.createHash('sha256').update(fs.readFileSync('prisma/migrations/<name>/migration.sql')).digest('hex'))"
>
> # Patch the DB row
> docker exec infra-postgres-1 psql -U fleetops -d fleetops_shore -c "UPDATE _prisma_migrations SET checksum = '<hash>' WHERE migration_name = '<name>';"
> ```
> This happened 3 times in Phase 2 (QHSE, Crewing, Audit migrations). Use `--create-only` to avoid it entirely.

---

## 24. Auth API — Current Format (post P2-2)

These changed in the P2-2 merge and are easy to get wrong in tests.

| Endpoint | Required fields | Notes |
|---|---|---|
| `POST /auth/login` | `identifier` (not `email`), `password`, optionally `tenantId` | `identifier` accepts email or username |
| `POST /tenants` admin | `email`, `username`, `password` | `username` is now required |
| `POST /users` | `email`, `username`, `password`, `role` | `username` is now required |

**In e2e tests on shore** — always use `identifier:` in login sends:
```ts
.send({ tenantId, identifier: 'user@example.com', password: 'Pass1234!' })
```

**In e2e tests on vessel** — the vessel auth still accepts `email:` in the body (vessel uses a different DTO). Do not change vessel tests to use `identifier`.

---

## 25. Domain Package — Rebuild After Adding Exports

`packages/domain` is compiled to `dist/` before consumers (api-shore, api-vessel) can import it. After adding a new export to `packages/domain/src/index.ts`, run:

```powershell
pnpm --filter @fleetops/domain run build
```

Otherwise TypeScript will report `Module '"@fleetops/domain"' has no exported member 'X'`. This happened when adding `checkMlcRestHours` in P2-4.

---

## 21. Standing Rules — Do Not Change

These settings exist for reasons. Do not alter them without explicit instruction from Ziad.

| Setting | Location | Value | Reason |
|---|---|---|---|
| `moduleResolution` in CJS tsconfigs | api-shore, api-vessel, desktop-vessel, domain/tsconfig.build.json, sync-engine/tsconfig.build.json | **NOT SET** (implicit) | TypeScript 5.9.3 emits TS5107 for any EXPLICIT `moduleResolution: node/node10`. The fix: do not specify `moduleResolution` in CJS tsconfigs — TypeScript derives `node10` implicitly from `module: CommonJS`, which does not trigger TS5107. Also removed `moduleResolution` from `tsconfig.base.json` for this reason. |
| `ignoreDeprecations` | Removed from all CJS tsconfigs | n/a | No longer needed after switching to implicit moduleResolution. |
| Vite port | `apps/web-shore/vite.config.ts` | `5342` | Port 5173 is in Windows Hyper-V excluded range 5141–5240; 5342 is the first available port after the exclusion. |
| Proto namespace | `packages/proto/sync.proto` | `fleetops.sync.v1` | Was `marad.sync.v1`; renamed during branding to FleetOps. All generated code references this namespace. |
