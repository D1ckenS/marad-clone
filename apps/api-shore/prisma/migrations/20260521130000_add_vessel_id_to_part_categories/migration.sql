-- Make part_categories vessel-scoped (was tenant-scoped only)
ALTER TABLE "part_categories" ADD COLUMN "vessel_id" TEXT REFERENCES "vessels"("id");

-- Replace the tenant-only index with a composite covering index
DROP INDEX IF EXISTS "part_categories_tenant_id_idx";
CREATE INDEX "part_categories_tenant_vessel_idx" ON "part_categories"("tenant_id", "vessel_id");
