-- CreateEnum
CREATE TYPE "CertificateSubjectType" AS ENUM ('VESSEL', 'COMPONENT', 'CREW_MEMBER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CERTIFICATE_EXPIRY');

-- CreateTable
CREATE TABLE "certificate_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "alert_days_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "certificate_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT,
    "certificate_type_id" TEXT NOT NULL,
    "subject_type" "CertificateSubjectType" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "number" TEXT,
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "issued_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_attachments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT,
    "certificate_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "certificate_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ref_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "certificate_types_tenant_id_idx" ON "certificate_types"("tenant_id");

-- CreateIndex
CREATE INDEX "certificates_tenant_id_vessel_id_idx" ON "certificates"("tenant_id", "vessel_id");

-- CreateIndex
CREATE INDEX "certificates_tenant_id_subject_type_subject_id_idx" ON "certificates"("tenant_id", "subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "certificates_tenant_id_expires_at_idx" ON "certificates"("tenant_id", "expires_at");

-- CreateIndex
CREATE INDEX "certificate_attachments_tenant_id_certificate_id_idx" ON "certificate_attachments"("tenant_id", "certificate_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_read_at_idx" ON "notifications"("tenant_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_type_ref_id_idx" ON "notifications"("tenant_id", "type", "ref_id");

-- AddForeignKey
ALTER TABLE "certificate_types" ADD CONSTRAINT "certificate_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_certificate_type_id_fkey" FOREIGN KEY ("certificate_type_id") REFERENCES "certificate_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_attachments" ADD CONSTRAINT "certificate_attachments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_attachments" ADD CONSTRAINT "certificate_attachments_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_attachments" ADD CONSTRAINT "certificate_attachments_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: row-level security for all 4 new tables
ALTER TABLE "certificate_types" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificate_types_tenant_isolation" ON "certificate_types"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "certificates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificates_tenant_isolation" ON "certificates"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "certificate_attachments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificate_attachments_tenant_isolation" ON "certificate_attachments"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_tenant_isolation" ON "notifications"
  USING (tenant_id = current_setting('app.tenant_id', true));
