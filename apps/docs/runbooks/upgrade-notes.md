# Upgrade Notes

Notes for upgrading an existing production deployment between
FleetOps releases. Read this BEFORE running `prisma migrate deploy`
on a populated database.

> Greenfield installs (fresh DBs) don't need this — all migrations are
> safe to run end-to-end from empty.

---

## Index

| Migration                                              | Risk         | Action required                                                |
| ------------------------------------------------------ | ------------ | -------------------------------------------------------------- |
| `20260518080000_generalize_sso_config`                 | NON-ADDITIVE | Maintenance window + backup + verify SSO configs first. See §1 |
| `20260521140000_remove_vessel_id_from_part_categories` | LOW          | Same-day mistake revert; data never went live. See §2          |

---

## 1. `20260518080000_generalize_sso_config` — Entra-specific columns dropped

**What it does:**

- Drops `entra_client_id`, `entra_tenant_id` from `tenant_sso_configs`.
- Promotes the previously-nullable `provider`, `discovery_url`,
  `client_id`, `redirect_uri` columns to `NOT NULL`.
- The data backfill that supplies the new NOT-NULL values runs in the
  same migration **before** the `SET NOT NULL` statements, so existing
  rows are projected from `entra_*` columns into the generic ones.

**Why it's non-additive:** dropped columns + `SET NOT NULL`. Cannot be
rolled back via `prisma migrate resolve --rolled-back` without manual
restoration.

**Pre-upgrade checklist:**

1. **Take a database backup.**
   ```bash
   pg_dump --format=custom --no-owner --no-acl \
     --file=pre-sso-generalize.dump "$DATABASE_URL"
   ```
2. **Verify every `tenant_sso_configs` row has the source data the
   backfill expects.** Specifically `entra_client_id` non-null and a
   reasonable `discovery_url`. If you've ever hand-edited this table,
   run:
   ```sql
   SELECT id, tenant_id, provider, entra_client_id IS NULL AS missing_client_id,
          discovery_url IS NULL AS missing_discovery
     FROM tenant_sso_configs;
   ```
   Any row with `missing_client_id = true` will fail the NOT NULL
   constraint after the backfill — patch it before running.
3. **Schedule a maintenance window.** The migration takes <1 s on small
   tables but blocks SSO login for the duration. Communicate to users.

**Run:**

```bash
pnpm --filter api-shore prisma migrate deploy
```

**Rollback (if catastrophic):**

```bash
pg_restore --clean --no-owner --no-acl \
  --dbname "$DATABASE_URL" pre-sso-generalize.dump
```

Then revert the api-shore deployment to the pre-migration commit.

---

## 2. `20260521140000_remove_vessel_id_from_part_categories` — Same-day correction

**What it does:** drops the `vessel_id` column from `part_categories`.

**Why it's safe in practice:** the column was added earlier the same
day in a sibling migration that never reached any production
deployment. If your data history doesn't include the addition, you
won't have the column to drop and Postgres will no-op the
`IF EXISTS`-guarded drop.

**Pre-upgrade checklist:**

1. Confirm `part_categories` does not actually contain meaningful
   `vessel_id` values:
   ```sql
   SELECT count(*) FILTER (WHERE vessel_id IS NOT NULL) AS rows_with_vessel,
          count(*) AS total
     FROM part_categories;
   ```
   If `rows_with_vessel > 0` for any tenant you've already provisioned
   on the affected build, **stop and contact the FleetOps team** — you
   may have unique part-category-per-vessel data that the global
   tenant-scoped model can't represent.
2. Otherwise: backup as a precaution (same `pg_dump` recipe as §1) and
   run the migration normally.

---

## 3. RLS policies — sanity check after every upgrade

The codebase ships RLS policies on all 75 tenant-scoped tables. After
any upgrade involving a new tenant-scoped model, verify:

```sql
SELECT tablename, policyname
  FROM pg_policies
 WHERE schemaname = 'public'
 ORDER BY tablename, policyname;
```

Every tenant-scoped table should have at least one policy whose name
ends in `_tenant_isolation`. If a newly-added table is missing one,
revert the api-shore deployment and file a bug — the RLS policy must
ship with the migration that introduces the table.

The e2e meta-test
[`apps/api-shore/test/deferred-stub-schemas.e2e.ts`](../../api-shore/test/deferred-stub-schemas.e2e.ts)
asserts policy existence for the 12 P4-1 stub tables; the
H7 PR (#68) extended this with a cross-tenant-isolation matrix for
`part-categories` as the representative tenant-scoped catalog (same RLS
template protects every other tenant-scoped table).

---

## 4. Vessel-side migrations (Drizzle)

Vessel SQLite migrations are bundled into the desktop-vessel installer
under `apps/desktop-vessel/api-vessel-bundle/drizzle/`. Apply order is
strict (Drizzle tracks `__drizzle_migrations`); skipping or reordering
breaks integrity.

The vessel database is recreated cheaply if corrupted (sync to shore,
nuke local, re-pair via the H15 QR flow, re-sync down). For a
populated vessel DB that you need to preserve, use the same backup
recipe as shore but via `sqlite3 .backup`:

```bash
sqlite3 "%APPDATA%\@fleetops\desktop-vessel\vessel.db" \
  ".backup vessel-backup.db"
```

Then run `pnpm --filter api-vessel run db:migrate` against the bundled
migrations directory. The new `actor_user_id NOT NULL DEFAULT 'system'`
column added in
`apps/desktop-vessel/api-vessel-bundle/drizzle/0018_empty_felicia_hardy.sql`
backfills existing rows so this is safe on populated DBs.
