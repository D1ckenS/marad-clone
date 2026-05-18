-- CreateEnum
CREATE TYPE "FindingKind" AS ENUM ('NEAR_MISS', 'NON_CONFORMANCE', 'OBSERVATION', 'HAZARD');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "CapaStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'VERIFIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChecklistInstanceStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "qhse_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "is_controlled" BOOLEAN NOT NULL DEFAULT false,
    "current_revision_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "qhse_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_revisions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "summary" TEXT,
    "s3_key" TEXT NOT NULL,
    "authored_by_user_id" TEXT,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "document_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "items_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_instances" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "template_id" TEXT,
    "title" TEXT NOT NULL,
    "status" "ChecklistInstanceStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "responses_json" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "checklist_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "kind" "FindingKind" NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "raised_by_user_id" TEXT,
    "raised_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "finding_id" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "due_date" TIMESTAMP(3),
    "status" "CapaStatus" NOT NULL DEFAULT 'OPEN',
    "verified_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "capas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qhse_documents_tenant_id_idx" ON "qhse_documents"("tenant_id");

-- CreateIndex
CREATE INDEX "document_revisions_tenant_id_document_id_idx" ON "document_revisions"("tenant_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_revisions_document_id_revision_number_key" ON "document_revisions"("document_id", "revision_number");

-- CreateIndex
CREATE INDEX "checklist_templates_tenant_id_idx" ON "checklist_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "checklist_instances_tenant_id_vessel_id_status_idx" ON "checklist_instances"("tenant_id", "vessel_id", "status");

-- CreateIndex
CREATE INDEX "findings_tenant_id_vessel_id_status_idx" ON "findings"("tenant_id", "vessel_id", "status");

-- CreateIndex
CREATE INDEX "findings_tenant_id_vessel_id_kind_idx" ON "findings"("tenant_id", "vessel_id", "kind");

-- CreateIndex
CREATE INDEX "capas_tenant_id_vessel_id_status_idx" ON "capas"("tenant_id", "vessel_id", "status");

-- CreateIndex
CREATE INDEX "capas_tenant_id_vessel_id_finding_id_idx" ON "capas"("tenant_id", "vessel_id", "finding_id");

-- AddForeignKey
ALTER TABLE "qhse_documents" ADD CONSTRAINT "qhse_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "qhse_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capas" ADD CONSTRAINT "capas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capas" ADD CONSTRAINT "capas_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capas" ADD CONSTRAINT "capas_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: tenant isolation on all QHSE tables
ALTER TABLE "qhse_documents"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_revisions"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_templates"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_instances"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "findings"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "capas"                ENABLE ROW LEVEL SECURITY;

CREATE POLICY qhse_documents_tenant_isolation       ON "qhse_documents"      USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY document_revisions_tenant_isolation   ON "document_revisions"  USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY checklist_templates_tenant_isolation  ON "checklist_templates" USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY checklist_instances_tenant_isolation  ON "checklist_instances" USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY findings_tenant_isolation             ON "findings"            USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY capas_tenant_isolation                ON "capas"               USING (tenant_id = current_setting('app.tenant_id', true));
