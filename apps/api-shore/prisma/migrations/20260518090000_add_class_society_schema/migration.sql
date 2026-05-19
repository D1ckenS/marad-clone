-- Class-society e-reporting connectors (P4-3)

CREATE TYPE "ClassSociety" AS ENUM ('DNV', 'ABS', 'LR', 'RINA', 'BV', 'NK');
CREATE TYPE "ClassSocietyReportType" AS ENUM ('PMS_EVIDENCE', 'CERTIFICATES', 'FINDINGS', 'SURVEY_STATUS');
CREATE TYPE "ClassSocietySubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'ERROR');

CREATE TABLE "class_society_connectors" (
    "id"                   TEXT NOT NULL,
    "tenant_id"            TEXT NOT NULL,
    "society"              "ClassSociety" NOT NULL,
    "api_key"              TEXT,
    "api_endpoint"         TEXT,
    "vessel_registrations" JSONB NOT NULL DEFAULT '{}',
    "enabled"              BOOLEAN NOT NULL DEFAULT true,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "class_society_connectors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "class_society_submissions" (
    "id"               TEXT NOT NULL,
    "tenant_id"        TEXT NOT NULL,
    "vessel_id"        TEXT NOT NULL,
    "connector_id"     TEXT NOT NULL,
    "society"          "ClassSociety" NOT NULL,
    "report_type"      "ClassSocietyReportType" NOT NULL,
    "status"           "ClassSocietySubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "payload_json"     JSONB,
    "submitted_at"     TIMESTAMP(3),
    "response_code"    INTEGER,
    "response_message" TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "class_society_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "class_society_connectors_tenant_id_society_key"
  ON "class_society_connectors"("tenant_id", "society");

CREATE INDEX "class_society_submissions_tenant_id_vessel_id_society_idx"
  ON "class_society_submissions"("tenant_id", "vessel_id", "society");

ALTER TABLE "class_society_connectors"
  ADD CONSTRAINT "class_society_connectors_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_society_submissions"
  ADD CONSTRAINT "class_society_submissions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_society_submissions"
  ADD CONSTRAINT "class_society_submissions_vessel_id_fkey"
  FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_society_submissions"
  ADD CONSTRAINT "class_society_submissions_connector_id_fkey"
  FOREIGN KEY ("connector_id") REFERENCES "class_society_connectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS
ALTER TABLE "class_society_connectors"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_society_submissions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_society_connectors_tenant_isolation"
  ON "class_society_connectors"
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY "class_society_submissions_tenant_isolation"
  ON "class_society_submissions"
  USING (tenant_id = current_setting('app.tenant_id', true));
