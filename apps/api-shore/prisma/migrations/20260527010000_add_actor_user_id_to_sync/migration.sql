-- B6: actorUserId on shore Outbox + SyncRecord
--
-- ULID of the user who triggered each write, or 'system' for changes with
-- no human actor (CRDT merges, scheduled jobs, pre-B6 backfill). Required
-- for the DNV CG-0339 §4.2 + ISO 27001 A.8.15 audit trail — without it,
-- shore can't answer "which crew member made this change?" when applying
-- vessel-originated deltas.
--
-- 'system' is the migration default + an explicit sentinel that downstream
-- audit code understands.

ALTER TABLE "outbox" ADD COLUMN "actor_user_id" TEXT NOT NULL DEFAULT 'system';
ALTER TABLE "sync_records" ADD COLUMN "actor_user_id" TEXT NOT NULL DEFAULT 'system';
