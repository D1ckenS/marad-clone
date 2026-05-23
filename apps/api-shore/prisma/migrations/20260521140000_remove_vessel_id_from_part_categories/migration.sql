-- PartCategory is fleet-wide (tenant-scoped), not vessel-scoped.
-- Remove the vessel_id column that was added by mistake and replace
-- the composite index with the original tenant-only index.

DROP INDEX IF EXISTS "part_categories_tenant_vessel_idx";

ALTER TABLE "part_categories" DROP COLUMN "vessel_id";

CREATE INDEX "part_categories_tenant_id_idx" ON "part_categories"("tenant_id");
