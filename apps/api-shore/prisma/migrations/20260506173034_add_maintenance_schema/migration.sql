-- CreateEnum
CREATE TYPE "JobInstanceStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RunningHourSource" AS ENUM ('MANUAL', 'API', 'PLC');

-- CreateTable
CREATE TABLE "master_components" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sfi" TEXT,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "master_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "components" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "master_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sfi" TEXT,
    "running_hours" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "interval_days" INTEGER,
    "interval_running_hours" DECIMAL(12,2),
    "estimated_hours" DECIMAL(8,2),
    "priority" "JobPriority" NOT NULL DEFAULT 'NORMAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_instances" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "status" "JobInstanceStatus" NOT NULL DEFAULT 'PENDING',
    "due_at" TIMESTAMP(3),
    "due_at_running_hours" DECIMAL(12,2),
    "assigned_to_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "job_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_histories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "job_instance_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "completed_by_user_id" TEXT NOT NULL,
    "hours_worked" DECIMAL(8,2),
    "notes" TEXT,
    "signature_hash" TEXT,
    "parts_consumed" JSONB,
    "photos" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "job_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "running_hour_readings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "source" "RunningHourSource" NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "recorded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "running_hour_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "master_components_tenant_id_idx" ON "master_components"("tenant_id");

-- CreateIndex
CREATE INDEX "components_tenant_id_vessel_id_idx" ON "components"("tenant_id", "vessel_id");

-- CreateIndex
CREATE INDEX "components_tenant_id_vessel_id_parent_id_idx" ON "components"("tenant_id", "vessel_id", "parent_id");

-- CreateIndex
CREATE INDEX "jobs_tenant_id_vessel_id_component_id_idx" ON "jobs"("tenant_id", "vessel_id", "component_id");

-- CreateIndex
CREATE INDEX "job_instances_tenant_id_vessel_id_status_due_at_idx" ON "job_instances"("tenant_id", "vessel_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "job_instances_tenant_id_vessel_id_component_id_idx" ON "job_instances"("tenant_id", "vessel_id", "component_id");

-- CreateIndex
CREATE INDEX "job_histories_tenant_id_vessel_id_completed_at_idx" ON "job_histories"("tenant_id", "vessel_id", "completed_at");

-- CreateIndex
CREATE INDEX "job_histories_tenant_id_vessel_id_job_instance_id_idx" ON "job_histories"("tenant_id", "vessel_id", "job_instance_id");

-- CreateIndex
CREATE INDEX "running_hour_readings_tenant_id_vessel_id_component_id_reco_idx" ON "running_hour_readings"("tenant_id", "vessel_id", "component_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "master_components" ADD CONSTRAINT "master_components_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "master_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_instances" ADD CONSTRAINT "job_instances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_instances" ADD CONSTRAINT "job_instances_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_instances" ADD CONSTRAINT "job_instances_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_instances" ADD CONSTRAINT "job_instances_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_histories" ADD CONSTRAINT "job_histories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_histories" ADD CONSTRAINT "job_histories_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_histories" ADD CONSTRAINT "job_histories_job_instance_id_fkey" FOREIGN KEY ("job_instance_id") REFERENCES "job_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_histories" ADD CONSTRAINT "job_histories_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_histories" ADD CONSTRAINT "job_histories_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "running_hour_readings" ADD CONSTRAINT "running_hour_readings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "running_hour_readings" ADD CONSTRAINT "running_hour_readings_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "running_hour_readings" ADD CONSTRAINT "running_hour_readings_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Jobs interval CHECK ─────────────────────────────────────────────────────
-- §9.1: a Job must have at least one of intervalDays or intervalRunningHours;
-- the scheduler picks whichever fires first.
ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_interval_required_chk"
  CHECK ("interval_days" IS NOT NULL OR "interval_running_hours" IS NOT NULL);

-- ── RLS — tenant isolation on every tenant-scoped maintenance table ─────────
-- Same policy shape as vessels/users (init migration): empty
-- app.current_tenant_id (e.g. SUPER_ADMIN sessions) bypasses isolation, otherwise
-- visibility is restricted to the tenant currently set on the connection.

ALTER TABLE "master_components" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "master_components_tenant_isolation" ON "master_components"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "components" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "components_tenant_isolation" ON "components"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_tenant_isolation" ON "jobs"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "job_instances" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_instances_tenant_isolation" ON "job_instances"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "job_histories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_histories_tenant_isolation" ON "job_histories"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "running_hour_readings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "running_hour_readings_tenant_isolation" ON "running_hour_readings"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

-- ── job_histories immutability ──────────────────────────────────────────────
-- §9.1: closed JobHistory records are immutable in the DB. The function below
-- fires BEFORE UPDATE and aborts if any business column would change. Sync
-- metadata (deleted_at, hlc, updated_at) may still be written so soft-delete
-- and HLC bumps continue to work after sign-off.

CREATE OR REPLACE FUNCTION "job_histories_block_business_updates"() RETURNS trigger AS $$
BEGIN
  IF (NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.vessel_id IS DISTINCT FROM OLD.vessel_id
      OR NEW.job_instance_id IS DISTINCT FROM OLD.job_instance_id
      OR NEW.job_id IS DISTINCT FROM OLD.job_id
      OR NEW.component_id IS DISTINCT FROM OLD.component_id
      OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
      OR NEW.completed_by_user_id IS DISTINCT FROM OLD.completed_by_user_id
      OR NEW.hours_worked IS DISTINCT FROM OLD.hours_worked
      OR NEW.notes IS DISTINCT FROM OLD.notes
      OR NEW.signature_hash IS DISTINCT FROM OLD.signature_hash
      OR NEW.parts_consumed::text IS DISTINCT FROM OLD.parts_consumed::text
      OR NEW.photos::text IS DISTINCT FROM OLD.photos::text
      OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'job_histories rows are immutable; only deleted_at, hlc, updated_at may be modified after insert'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "job_histories_immutable"
  BEFORE UPDATE ON "job_histories"
  FOR EACH ROW
  EXECUTE FUNCTION "job_histories_block_business_updates"();
