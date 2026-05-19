-- CreateEnum
CREATE TYPE "TechLibraryProvider" AS ENUM ('TWO_BA', 'NARETO');

-- CreateEnum
CREATE TYPE "OcimfInspectionType" AS ENUM ('SIRE', 'CDI', 'TMSA');

-- CreateEnum
CREATE TYPE "AccountingProvider" AS ENUM ('EXACT', 'SAP', 'TWINFIELD', 'NETSUITE', 'CSV');

-- CreateTable
CREATE TABLE "tenant_sso_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entra_client_id" TEXT NOT NULL,
    "entra_tenant_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_sso_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_library_connectors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" "TechLibraryProvider" NOT NULL DEFAULT 'TWO_BA',
    "api_key" TEXT NOT NULL,
    "endpoint" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tech_library_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocimf_inspections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "inspection_type" "OcimfInspectionType" NOT NULL,
    "inspection_date" TEXT NOT NULL,
    "inspector" TEXT,
    "port" TEXT,
    "report_number" TEXT,
    "overall_score" DECIMAL(4,2),
    "observations_json" JSONB,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocimf_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_connectors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" "AccountingProvider" NOT NULL DEFAULT 'CSV',
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_sso_configs_tenant_id_key" ON "tenant_sso_configs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tech_library_connectors_tenant_id_key" ON "tech_library_connectors"("tenant_id");

-- CreateIndex
CREATE INDEX "ocimf_inspections_tenant_id_vessel_id_inspection_date_idx" ON "ocimf_inspections"("tenant_id", "vessel_id", "inspection_date");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_connectors_tenant_id_key" ON "accounting_connectors"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_sso_configs" ADD CONSTRAINT "tenant_sso_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_library_connectors" ADD CONSTRAINT "tech_library_connectors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocimf_inspections" ADD CONSTRAINT "ocimf_inspections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocimf_inspections" ADD CONSTRAINT "ocimf_inspections_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_connectors" ADD CONSTRAINT "accounting_connectors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS
ALTER TABLE "tenant_sso_configs"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tech_library_connectors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ocimf_inspections"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_connectors"   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sso_configs_tenant_isolation"         ON "tenant_sso_configs"      USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "tech_library_tenant_isolation"        ON "tech_library_connectors" USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "ocimf_inspections_tenant_isolation"   ON "ocimf_inspections"       USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "accounting_connectors_tenant_isolation" ON "accounting_connectors" USING (tenant_id = current_setting('app.tenant_id', true));
