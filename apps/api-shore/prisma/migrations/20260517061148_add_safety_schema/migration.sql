-- CreateEnum
CREATE TYPE "DrillStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkPermitStatus" AS ENUM ('REQUESTED', 'APPROVED', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkPermitType" AS ENUM ('HOT_WORK', 'CONFINED_SPACE', 'WORKING_AT_HEIGHT', 'ELECTRICAL_ISOLATION', 'COLD_WORK', 'DIVING', 'OVERSIDE_WORK');

-- CreateTable
CREATE TABLE "drill_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "drill_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drills" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "drill_type_id" TEXT NOT NULL,
    "status" "DrillStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "conducted_at" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "location" TEXT,
    "lead_officer" TEXT,
    "notes" TEXT,
    "report_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "drills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drill_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "drill_id" TEXT NOT NULL,
    "participant_name" TEXT NOT NULL,
    "role" TEXT,
    "signed_at" TIMESTAMP(3),
    "signature_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "drill_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permit_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "permit_type" "WorkPermitType" NOT NULL,
    "name" TEXT NOT NULL,
    "checklist_items_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "permit_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_permits" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "permit_type" "WorkPermitType" NOT NULL,
    "template_id" TEXT,
    "status" "WorkPermitStatus" NOT NULL DEFAULT 'REQUESTED',
    "title" TEXT NOT NULL,
    "location" TEXT,
    "work_description" TEXT,
    "requested_by_user_id" TEXT,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "risk_assessment_json" TEXT,
    "gas_test_json" TEXT,
    "hazards_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "work_permits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permit_approvals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "permit_id" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL,
    "signature_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "permit_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drill_types_tenant_id_idx" ON "drill_types"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "drill_types_tenant_id_name_key" ON "drill_types"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "drills_tenant_id_vessel_id_status_idx" ON "drills"("tenant_id", "vessel_id", "status");

-- CreateIndex
CREATE INDEX "drills_tenant_id_vessel_id_scheduled_at_idx" ON "drills"("tenant_id", "vessel_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "drill_records_tenant_id_vessel_id_drill_id_idx" ON "drill_records"("tenant_id", "vessel_id", "drill_id");

-- CreateIndex
CREATE INDEX "permit_templates_tenant_id_idx" ON "permit_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "work_permits_tenant_id_vessel_id_status_idx" ON "work_permits"("tenant_id", "vessel_id", "status");

-- CreateIndex
CREATE INDEX "work_permits_tenant_id_vessel_id_permit_type_idx" ON "work_permits"("tenant_id", "vessel_id", "permit_type");

-- CreateIndex
CREATE INDEX "permit_approvals_tenant_id_vessel_id_permit_id_idx" ON "permit_approvals"("tenant_id", "vessel_id", "permit_id");

-- AddForeignKey
ALTER TABLE "drill_types" ADD CONSTRAINT "drill_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drills" ADD CONSTRAINT "drills_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drills" ADD CONSTRAINT "drills_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drills" ADD CONSTRAINT "drills_drill_type_id_fkey" FOREIGN KEY ("drill_type_id") REFERENCES "drill_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drill_records" ADD CONSTRAINT "drill_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drill_records" ADD CONSTRAINT "drill_records_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drill_records" ADD CONSTRAINT "drill_records_drill_id_fkey" FOREIGN KEY ("drill_id") REFERENCES "drills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_templates" ADD CONSTRAINT "permit_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "permit_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_approvals" ADD CONSTRAINT "permit_approvals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_approvals" ADD CONSTRAINT "permit_approvals_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_approvals" ADD CONSTRAINT "permit_approvals_permit_id_fkey" FOREIGN KEY ("permit_id") REFERENCES "work_permits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: tenant isolation on all safety tables
ALTER TABLE drill_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY drill_types_tenant_isolation ON drill_types
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
CREATE POLICY drills_tenant_isolation ON drills
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE drill_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY drill_records_tenant_isolation ON drill_records
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE permit_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY permit_templates_tenant_isolation ON permit_templates
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE work_permits ENABLE ROW LEVEL SECURITY;
CREATE POLICY work_permits_tenant_isolation ON work_permits
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE permit_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY permit_approvals_tenant_isolation ON permit_approvals
  USING (tenant_id = current_setting('app.tenant_id', true));

-- CHECK: HOT_WORK permit cannot be ACTIVE without risk_assessment_json
ALTER TABLE work_permits ADD CONSTRAINT work_permits_hot_work_active_needs_risk_chk
  CHECK (NOT (permit_type = 'HOT_WORK' AND status = 'ACTIVE' AND risk_assessment_json IS NULL));
