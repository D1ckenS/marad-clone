# ADR 0004 — Shore → vessel sync for tenant-scoped catalogs

**Date:** 2026-05-24
**Status:** Accepted
**Deciders:** Ziad (product), Claude Code (implementation)
**Builds on:** ADR 0002 (Sync Wire Protocol), ADR 0003 (Blob Sync)

---

## Context

The existing sync engine (ADR 0001/0002) was designed for vessel-scoped
entities: a Drill, JobHistory, WorkPermit, etc. is owned by exactly one
vessel; vessel writes flow up to shore via the outbox; shore replays
them into `sync_records`. That works for the operational tier.

The other half of the story — **tenant-scoped catalogs** managed by the
office and consumed by every vessel — has been an outstanding gap. The
codebase audit (2026-05-23) called it out:

> **P1-2 follow-up: master library replication shore→vessel.** Vessel
> `master_components` is read-only and empty until a broadcast mechanism
> lands. **Same gap now affects the 4 new tenant-scoped catalogs** (Jha,
> QhseObjective, DrybmsElement, ManagementReview) — they exist on
> vessel but won't receive shore writes until this is built.

Without this, the offline-parity claim from REFERENCE.md §2 is only
half true: a vessel sees the entity tables for tenant-scoped data but
the rows are blank until somebody uploads them manually.

The 16 tenant-scoped entities involved:

| Module       | Entity                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Maintenance  | `MasterComponent`                                                                                                    |
| Inventory    | `PartCategory`                                                                                                       |
| Purchase     | `Supplier`, `ApprovalFlow`, `ApprovalStep`                                                                           |
| Certificates | `CertificateType`                                                                                                    |
| Safety       | `DrillType`, `PermitTemplate`                                                                                        |
| QHSE         | `ChecklistTemplate`, `QhseDocument`, `DocumentRevision`, `Jha`, `QhseObjective`, `DrybmsElement`, `ManagementReview` |
| FLGO         | `FuelProduct`                                                                                                        |

---

## Decisions

### 1. Broadcast pattern: fan out on write

When shore writes a tenant-scoped entity, it generates one outbox row
per vessel of that tenant. The existing per-(tenant, vessel) outbox
machinery (ADR 0002 §9) and per-(tenant, vessel) `sync_records` table
absorb the fan-out without protocol changes.

- **Storage cost:** O(vessels-per-tenant) outbox rows per write.
  Realistic pilot sizes are 1–10 vessels per tenant; not a concern.
- **No protocol change:** vessels drain their own per-(tenant, vessel)
  outbox slice on stream open, exactly like vessel-originated entity
  deltas. The deltas just happen to originate on shore now.

Alternative considered: a single "broadcast" outbox row with
`vesselId=NULL` plus drain-time fan-out. Rejected because it would
require a special read path everywhere and break the "one row, one
delta" invariant the protocol depends on. Can be swapped in later
without API change if storage becomes an issue.

### 2. `TenantBroadcastRecorder` is a thin wrapper over `OutboxRecorder`

```ts
class TenantBroadcastRecorder {
  async broadcastUpsert(tx, tenantId, entityType, entityId, fields) {
    const vessels = await tx.vessel.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    for (const v of vessels) {
      await this.outbox.recordUpsert(
        tx,
        { tenantId, vesselId: v.id },
        entityType,
        entityId,
        fields,
      );
    }
  }
  // broadcastDelete: symmetrical
}
```

Reuses the existing HLC / LWW / outbox / sync_records pipeline. Pass
the same Prisma `tx` you used for the entity write — fan-out and
entity write commit atomically.

### 3. Vessel materialisation: project sync_record → entity table

The existing sync engine only writes `sync_records` on apply. For
vessel-scoped entities the entity table is populated by the
originating service (vessel writes its own `drills` row, then the
delta carries the metadata up to shore). For tenant-scoped entities
the originating service is on **shore**, so the vessel has no
chance to populate its entity table from a domain write — the
delta is the only source of the data.

We solved this by extending `DrizzleSyncAdapter.applyRemoteDelta`
to call a per-entity-type materialiser after the `sync_records`
upsert:

```ts
// apps/api-vessel/src/sync/tenant-materialisers.ts
const tenantMaterialisers: Record<string, MaterialiserFn> = {
  Jha: (db, id, fields, hlc, deletedAt) => {
    /* upsert/delete on jhas */
  },
  MasterComponent: (db, id, fields, hlc, deletedAt) => {
    /* … */
  },
  // … one per tenant-scoped entity
};
```

Each materialiser:

- Reads the merged LWW field values (e.g. `f(fields, 'name')`)
- Writes a typed drizzle `insert().onConflictDoUpdate()` to the entity
  table
- Soft-deletes on delete via `update().set({ deletedAt }).where(eq(t.id, id))`
- Handles JSON columns by re-stringifying
- Handles booleans via drizzle's `mode: 'boolean'` conversion

Vessel-scoped entities have no materialiser registered, so the
existing applyRemoteDelta path is unchanged for them — only
`sync_records` gets written, matching today's behavior.

### 4. Conflicts: per-field LWW (consistent with engine)

When a tenant-scoped delta arrives, the existing per-field LWW merge
runs (`mergeFields(existing, incoming)`). If a vessel ever held a
locally-edited copy of a tenant-scoped row (e.g. for offline edits),
the later HLC wins — exactly as for vessel-scoped entities.

In practice today, vessel services don't write to tenant-scoped tables
at all (they're shore-managed catalogs). The LWW path is what would
correctly handle the case if vessel-side editing is ever added.

### 5. The `tenantId` field travels in every broadcast payload

Because each tenant-scoped entity row has a `tenant_id` column that
the vessel materialiser must populate, shore's `broadcastFields()`
helpers explicitly include `tenantId` in the broadcast payload. The
materialiser reads it back via `str(fields, 'tenantId')` to satisfy
the FK constraint against the vessel's `tenants` table.

---

## Out of scope

- **Initial backfill.** A vessel that comes online for the first time
  doesn't yet have _any_ existing tenant catalogs — only future shore
  writes will reach it via this mechanism. A one-time "send everything
  for this tenant on first connection" pass (or a manual seed script)
  is the right way to populate the initial state. Tracked as follow-up.
- **Sync from vessel back to shore for tenant-scoped entities.** Not
  required today (shore is canonical for the catalog) and would need
  conflict resolution beyond per-field LWW (who wins when two
  vessels edit the same catalog row simultaneously?). Defer until a
  real use case appears.
- **Tombstone GC.** Soft-deleted rows accumulate on both sides
  forever. The existing engine has this gap too; future ADR.

---

## Consequences

**Positive**

- A pilot vessel can now see the office's catalog updates without
  manual sync: a new JHA, a revised QHSE controlled document, a new
  approval flow — all reach the ship on next reconnect.
- The mechanism is generic: adding a 17th tenant-scoped entity is
  ~20 lines of vessel materialiser + ~30 lines of shore-service
  wiring. No new infrastructure.
- The full offline-parity claim from REFERENCE.md §2 is finally true
  for tenant-scoped data.

**Negative**

- Every tenant-scoped service write now incurs O(vessels) extra
  inserts (outbox + sync_records per vessel). For a 5-vessel tenant
  doing one shore write = 5 outbox + 5 sync_records rows. Cheap, but
  visible in `EXPLAIN ANALYZE`.
- The materialiser registry duplicates schema knowledge: column
  names appear in both the Drizzle schema and the materialiser. A
  schema rename means updating two places. Acceptable tax for a
  type-safe materialiser.
- Initial-state replication is still a manual concern (see Out of
  Scope above).

---

## Verification

`apps/api-vessel/test/tenant-broadcast-sync.e2e.ts` — 7 tests:

1. Materialiser registry has handlers for all 16 entities
2. `materialiseTenantEntity` returns false for unregistered types
3. Jha upsert delta → row in `jhas` table
4. Jha LWW-merged update delta → re-projected fields preserved
5. Jha delete delta → soft-deleted row
6. DrybmsElement (simpler entity) round-trip
7. QhseObjective with JSON `trend` array survives serialisation

`pnpm -w run ci:full` ✓ — lint + typecheck:all + 156 unit + format.
Vessel e2e: **150 ✓** (18 files, +7 from this ADR). Shore e2e
unchanged.
