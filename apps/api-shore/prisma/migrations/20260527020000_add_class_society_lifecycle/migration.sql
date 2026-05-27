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
