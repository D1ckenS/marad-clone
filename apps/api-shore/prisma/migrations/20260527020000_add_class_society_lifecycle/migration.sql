-- H9: class-society lifecycle tracking
--
-- Adds external_ref + lastPolledAt + webhookReceivedAt to
-- class_society_submissions so the SUBMITTED → ACCEPTED / REJECTED
-- transition can be driven by either a cron poller (DNV Veracity /
-- ABS / LR / etc.) or an inbound webhook from the society.

ALTER TABLE "class_society_submissions"
  ADD COLUMN "external_ref" TEXT,
  ADD COLUMN "last_polled_at" TIMESTAMP(3),
  ADD COLUMN "webhook_received_at" TIMESTAMP(3);

-- Polling index — the cron scans SUBMITTED rows ordered by last_polled_at
-- ASC NULLS FIRST so newly-submitted rows poll quickly and recently-polled
-- ones wait for the next tick.
CREATE INDEX "class_society_submissions_polling_idx"
  ON "class_society_submissions" ("status", "last_polled_at");

-- Per-connector webhook shared secret. Inbound webhooks must echo it in
-- the `X-FleetOps-Webhook-Secret` header. NULL value disables webhook
-- callbacks for that connector (the endpoint returns 401).
ALTER TABLE "class_society_connectors"
  ADD COLUMN "webhook_secret" TEXT;

-- The original class-society RLS policies (added in
-- 20260518090000_add_class_society_schema) keyed off `app.tenant_id` and
-- had NO empty-string bypass clause. The H9 cron poller + webhook
-- receiver are system processes that must read across all tenants, so
-- they need the same `current_setting(...) = ''` escape hatch every other
-- tenant-scoped table provides. Recreate the policies with the standard
-- two-clause USING expression (matches users, vessels, etc.).
DROP POLICY IF EXISTS "class_society_connectors_tenant_isolation"
  ON "class_society_connectors";
CREATE POLICY "class_society_connectors_tenant_isolation"
  ON "class_society_connectors"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

DROP POLICY IF EXISTS "class_society_submissions_tenant_isolation"
  ON "class_society_submissions";
CREATE POLICY "class_society_submissions_tenant_isolation"
  ON "class_society_submissions"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );
