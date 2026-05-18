-- CreateEnum
CREATE TYPE "CrewMemberStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SIGNED_OFF');

-- CreateEnum
CREATE TYPE "RotationStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "crew_members" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "nationality" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "email" TEXT,
    "phone" TEXT,
    "status" "CrewMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "sign_on_date" TIMESTAMP(3),
    "sign_off_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crew_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "crew_member_id" TEXT NOT NULL,
    "planned_sign_on" TIMESTAMP(3) NOT NULL,
    "planned_sign_off" TIMESTAMP(3) NOT NULL,
    "actual_sign_on" TIMESTAMP(3),
    "actual_sign_off" TIMESTAMP(3),
    "status" "RotationStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rest_hour_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "crew_member_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hours_worked_json" TEXT NOT NULL,
    "mlc_valid" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rest_hour_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_certificates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "crew_member_id" TEXT NOT NULL,
    "certificate_type" TEXT NOT NULL,
    "number" TEXT,
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "issued_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crew_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crew_members_tenant_id_vessel_id_idx" ON "crew_members"("tenant_id", "vessel_id");

-- CreateIndex
CREATE INDEX "crew_members_tenant_id_vessel_id_status_idx" ON "crew_members"("tenant_id", "vessel_id", "status");

-- CreateIndex
CREATE INDEX "rotations_tenant_id_vessel_id_crew_member_id_idx" ON "rotations"("tenant_id", "vessel_id", "crew_member_id");

-- CreateIndex
CREATE INDEX "rotations_tenant_id_vessel_id_status_idx" ON "rotations"("tenant_id", "vessel_id", "status");

-- CreateIndex
CREATE INDEX "rest_hour_entries_tenant_id_vessel_id_crew_member_id_idx" ON "rest_hour_entries"("tenant_id", "vessel_id", "crew_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "rest_hour_entries_tenant_id_vessel_id_crew_member_id_date_key" ON "rest_hour_entries"("tenant_id", "vessel_id", "crew_member_id", "date");

-- CreateIndex
CREATE INDEX "crew_certificates_tenant_id_vessel_id_crew_member_id_idx" ON "crew_certificates"("tenant_id", "vessel_id", "crew_member_id");

-- CreateIndex
CREATE INDEX "crew_certificates_tenant_id_expires_at_idx" ON "crew_certificates"("tenant_id", "expires_at");

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotations" ADD CONSTRAINT "rotations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotations" ADD CONSTRAINT "rotations_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotations" ADD CONSTRAINT "rotations_crew_member_id_fkey" FOREIGN KEY ("crew_member_id") REFERENCES "crew_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rest_hour_entries" ADD CONSTRAINT "rest_hour_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rest_hour_entries" ADD CONSTRAINT "rest_hour_entries_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rest_hour_entries" ADD CONSTRAINT "rest_hour_entries_crew_member_id_fkey" FOREIGN KEY ("crew_member_id") REFERENCES "crew_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_certificates" ADD CONSTRAINT "crew_certificates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_certificates" ADD CONSTRAINT "crew_certificates_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_certificates" ADD CONSTRAINT "crew_certificates_crew_member_id_fkey" FOREIGN KEY ("crew_member_id") REFERENCES "crew_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: tenant isolation on all Crewing tables
ALTER TABLE "crew_members"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rotations"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rest_hour_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crew_certificates" ENABLE ROW LEVEL SECURITY;

CREATE POLICY crew_members_tenant_isolation      ON "crew_members"      USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY rotations_tenant_isolation         ON "rotations"         USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY rest_hour_entries_tenant_isolation ON "rest_hour_entries" USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY crew_certificates_tenant_isolation ON "crew_certificates" USING (tenant_id = current_setting('app.tenant_id', true));
