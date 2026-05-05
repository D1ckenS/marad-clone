# ADR 0001 — Sync Engine Design

**Date:** 2026-05-05
**Status:** Accepted
**Deciders:** Ziad (product), Claude Code (implementation)

---

## Context

`marad-clone` is an offline-first fleet management system. Vessels operate with full feature parity while disconnected from shore for days or weeks (satellite windows, dry-dock, remote anchorage). When connectivity is restored, vessel and shore databases must converge to the same state with zero data loss.

Two database backends are in play:

- **Vessel:** SQLite (single-tenant, runs inside Electron on the ship PC)
- **Shore:** PostgreSQL (multi-tenant, cloud-hosted)

Any number of vessels belonging to one tenant may sync to the same shore database. Mobile clients (Flutter) sync to the vessel API over ship Wi-Fi.

---

## Decisions

### 1. Outbox pattern for durable write capture

Every write that must sync is first appended to a local `outbox` table (or in-memory queue in tests) within the same transaction as the data change. A background sender drains the outbox when a transport is available.

**Why:** Avoids dual-write hazards. The write and its sync event are atomic — if the DB write succeeds, the outbox entry exists; if it fails, neither exists. No writes are silently dropped during an offline window.

### 2. Hybrid Logical Clock (HLC) for causality

Every synced record carries an `hlc` field (format: `<12-hex-ms>-<4-hex-counter>-<nodeId>`). The HLC implementation is imported from `@marad-clone/domain/clock` — not duplicated here.

**Why:** Wall-clock timestamps alone are unreliable across vessels (clocks drift, NTP is unavailable offshore). HLC advances monotonically even when `Date.now()` goes backwards, and it preserves causal ordering across nodes. The encoded format is lexicographically sortable, which makes `ORDER BY hlc` correct without parsing.

### 3. Per-field Last-Write-Wins (LWW) conflict resolution

When two nodes have both written to the same record, conflicts are resolved field-by-field: the value carrying the higher HLC wins. Ties in HLC (same millisecond + counter) are broken deterministically by `nodeId` string comparison.

**Why:**

- Per-field LWW preserves concurrent edits to different fields of the same record (e.g., vessel updates `notes`, shore updates `status` — both survive).
- Record-level LWW would silently discard one node's entire set of changes.
- Operational transforms or vector clocks are far more complex and offer no meaningful benefit for the single-writer-per-field pattern that maritime workflows exhibit.

**Trade-off accepted:** If two nodes edit the _same field_ concurrently, the higher-HLC write wins and the other is discarded. This is intentional — it mirrors the "last person to save wins" mental model that maritime crew already have. True merge semantics are not needed for text/enum/numeric fields.

### 4. PN-Counter CRDT for inventory ROB

Inventory "Remaining On Board" quantities are modelled as a **PN-Counter** (Positive-Negative Counter): each node accumulates its own positive deltas (receipts, deliveries) and negative deltas (consumptions, adjustments) independently. The converged ROB = Σ(all positive deltas) − Σ(all negative deltas) across all nodes.

**Why:**

- ROB is a running total derived from stock movements, not a single field to overwrite. LWW on a raw quantity would produce phantom stock when two nodes both consume from the same ROB concurrently.
- PN-Counter is commutative, associative, and idempotent — the three properties required for eventual consistency. Replaying the same delta twice produces the same result.
- The CRDT lives in the sync engine layer; the application layer still records individual `StockMovement` rows for auditability.

**Reservation semantics deferred:** Preventing over-consumption while offline (e.g., two crew members both consume the last unit) is an operational UX concern, not a sync-correctness concern. It will be addressed in Phase 1 with soft warnings.

### 5. In-memory adapter for tests

The engine is parameterised over a `SyncAdapter` interface (read outbox, mark sent, apply remote delta). Tests use an `InMemoryAdapter` that holds state in plain Maps.

**Why:** No SQLite or Postgres is needed to test sync logic. Tests run in milliseconds and cover arbitrarily complex multi-node topologies.

### 6. Simulated clock for the soak test

The soak test (`scripts/sync-soak-test.ts`) advances time via an injected `now: () => number` rather than sleeping for 30 real minutes.

**Why:** CI must complete in under 10 minutes. Simulating the 30-minute horizon takes ~1 second with a fast-forward clock while exercising the same code paths.

---

## Alternatives Rejected

| Option                        | Reason rejected                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Record-level LWW              | Discards concurrent edits to different fields                                                                    |
| G-Counter only (no negatives) | Cannot model consumptions / adjustments                                                                          |
| Operational transforms        | Excessive complexity; no plain-text fields requiring character-level merge                                       |
| CRDTs for all fields          | Most fields (status enums, dates, names) have clear "one writer owns this" semantics; LWW is correct and simpler |
| Event sourcing at sync layer  | Deferred — may revisit if audit requirements demand it in Phase 2                                                |

---

## Consequences

- Every sync-aware table **must** include `hlc`, `updated_at`, `deleted_at` (soft delete only). Hard deletes are forbidden on synced tables.
- Node IDs must be stable per install (vessel ID + role suffix, e.g., `01J...vessel` / `01J...shore`).
- The outbox must be drained before a vessel database backup is taken, or the backup must include the outbox.
- The `@marad-clone/domain` package is a dependency of `@marad-clone/sync-engine`; the reverse must never be true.
