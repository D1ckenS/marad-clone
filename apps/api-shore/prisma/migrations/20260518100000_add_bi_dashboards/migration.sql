-- BI dashboards registry (P4-4)

CREATE TABLE "bi_dashboards" (
    "id"                   TEXT NOT NULL,
    "tenant_id"            TEXT NOT NULL,
    "superset_dashboard_id" TEXT NOT NULL,
    "title"                TEXT NOT NULL,
    "description"          TEXT,
    "category"             TEXT,
    "sort_order"           INTEGER NOT NULL DEFAULT 0,
    "enabled"              BOOLEAN NOT NULL DEFAULT true,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bi_dashboards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bi_dashboards_tenant_id_enabled_idx" ON "bi_dashboards"("tenant_id", "enabled");

ALTER TABLE "bi_dashboards"
  ADD CONSTRAINT "bi_dashboards_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bi_dashboards" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bi_dashboards_tenant_isolation" ON "bi_dashboards"
  USING (tenant_id = current_setting('app.tenant_id', true));
