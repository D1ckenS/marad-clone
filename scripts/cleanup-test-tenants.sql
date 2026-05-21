-- Wipe all non-ABM tenants (test pollution). Run as superuser to bypass RLS.
-- ABM kept: id = '01KQWX2HPGZBJJR9Z8W53SQJM4'

SET app.current_tenant_id = '';
SET session_replication_role = replica;  -- bypass FK constraints for bulk wipe

BEGIN;

DO $$
DECLARE
  keep CONSTANT TEXT := '01KQWX2HPGZBJJR9Z8W53SQJM4';
  rec RECORD;
  sql TEXT;
BEGIN
  -- Delete from every tenant-scoped table EXCEPT tenants in dependency-friendly order
  -- (we use information_schema to find all tables that have tenant_id and zap them).
  FOR rec IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'tenant_id'
      AND table_schema = 'public'
      AND table_name <> 'tenants'
  LOOP
    sql := format('DELETE FROM %I WHERE tenant_id <> %L', rec.table_name, keep);
    RAISE NOTICE '%', sql;
    EXECUTE sql;
  END LOOP;

  -- Finally remove the tenant rows themselves
  EXECUTE format('DELETE FROM tenants WHERE id <> %L', keep);
END $$;

COMMIT;

SET session_replication_role = origin;

-- Verify
SELECT COUNT(*) AS remaining_tenants FROM tenants;
