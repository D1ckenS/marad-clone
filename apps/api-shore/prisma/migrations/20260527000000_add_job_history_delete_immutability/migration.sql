-- B8: job_histories DELETE immutability
--
-- The existing job_histories_immutable trigger (added in
-- 20260506173034_add_maintenance_schema) is BEFORE UPDATE only. DNV CG-0339
-- + ISO 27001 A.8.15 require sign-off records be both update-immutable AND
-- delete-immutable — otherwise an admin who can DELETE the row can defeat
-- the audit trail without leaving evidence in the UPDATE trigger.
--
-- This migration adds the matching BEFORE DELETE trigger. Soft-delete via
-- deleted_at on the row itself is unaffected — that's an UPDATE, not a
-- DELETE, and the UPDATE trigger explicitly whitelists deleted_at.

CREATE OR REPLACE FUNCTION "job_histories_block_deletes"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'job_histories rows are immutable (DNV CG-0339); use soft-delete via deleted_at instead'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "job_histories_no_delete"
  BEFORE DELETE ON "job_histories"
  FOR EACH ROW
  EXECUTE FUNCTION "job_histories_block_deletes"();
