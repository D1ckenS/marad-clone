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

## 21. Standing Rules — Do Not Change

These settings exist for reasons. Do not alter them without explicit instruction from Ziad.

| Setting | Location | Value | Reason |
|---|---|---|---|
| `ignoreDeprecations` | All tsconfig files | `"5.0"` | Project TypeScript is 5.9.3; the only valid value is `"5.0"`. Silences the `moduleResolution: Node10` deprecation warning. |
| Vite port | `apps/web-shore/vite.config.ts` | `5342` | Port 5173 is in Windows Hyper-V excluded range 5141–5240; 5342 is the first available port after the exclusion. |
| Proto namespace | `packages/proto/sync.proto` | `fleetops.sync.v1` | Was `marad.sync.v1`; renamed during branding to FleetOps. All generated code references this namespace. |
