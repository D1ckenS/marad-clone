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
