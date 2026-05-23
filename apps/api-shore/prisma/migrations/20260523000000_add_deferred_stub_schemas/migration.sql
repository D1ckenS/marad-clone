-- Phase-2/3 follow-up: backfill schemas for the 12 deferred-stub endpoints.
-- Replaces the empty-array placeholders previously served by DeferredStubsController.

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "SurveyStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED', 'CANCELLED');
CREATE TYPE "CocSeverity" AS ENUM ('CONDITION', 'RECOMMENDATION', 'MEMORANDUM', 'CLOSED');
CREATE TYPE "InspectionKind" AS ENUM ('PSC', 'VETTING', 'FLAG');
CREATE TYPE "SafetyEquipmentCategory" AS ENUM ('FFA', 'LSA', 'OTH');
CREATE TYPE "SafetyEquipmentStatus" AS ENUM ('GREEN', 'AMBER', 'RED');
CREATE TYPE "QhseObjectiveCategory" AS ENUM ('Q', 'H', 'S', 'E');
CREATE TYPE "QhseObjectiveStatus" AS ENUM ('GREEN', 'AMBER', 'RED');
CREATE TYPE "AuditKind" AS ENUM ('INTERNAL', 'EXTERNAL', 'CLASS', 'FLAG');
CREATE TYPE "AuditStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "VoyageMode" AS ENUM ('LADEN', 'BALLAST');
CREATE TYPE "ManagementReviewStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'CLOSED', 'CANCELLED');

-- ── surveys ──────────────────────────────────────────────────────────────────

CREATE TABLE "surveys" (
    "id"             TEXT NOT NULL,
    "tenant_id"      TEXT NOT NULL,
    "vessel_id"      TEXT NOT NULL,
    "scheduled_at"   TIMESTAMP(3) NOT NULL,
    "kind"           TEXT NOT NULL,
    "scope"          TEXT NOT NULL,
    "surveyor"       TEXT NOT NULL,
    "location"       TEXT NOT NULL,
    "status"         "SurveyStatus" NOT NULL DEFAULT 'SCHEDULED',
    "certificate_id" TEXT,
    "notes"          TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    "deleted_at"     TIMESTAMP(3),
    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "surveys_tenant_id_vessel_id_scheduled_at_idx" ON "surveys"("tenant_id", "vessel_id", "scheduled_at");
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── conditions_of_class ──────────────────────────────────────────────────────

CREATE TABLE "conditions_of_class" (
    "id"                    TEXT NOT NULL,
    "tenant_id"             TEXT NOT NULL,
    "vessel_id"             TEXT NOT NULL,
    "severity"              "CocSeverity" NOT NULL,
    "title"                 TEXT NOT NULL,
    "detail"                TEXT NOT NULL,
    "raised_at"             TIMESTAMP(3) NOT NULL,
    "opened_at"             TIMESTAMP(3) NOT NULL,
    "due_at"                TIMESTAMP(3),
    "closed_at"             TIMESTAMP(3),
    "linked_certificate_id" TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,
    "deleted_at"            TIMESTAMP(3),
    CONSTRAINT "conditions_of_class_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "conditions_of_class_tenant_id_vessel_id_severity_idx" ON "conditions_of_class"("tenant_id", "vessel_id", "severity");
ALTER TABLE "conditions_of_class" ADD CONSTRAINT "conditions_of_class_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conditions_of_class" ADD CONSTRAINT "conditions_of_class_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── inspections ──────────────────────────────────────────────────────────────

CREATE TABLE "inspections" (
    "id"            TEXT NOT NULL,
    "tenant_id"     TEXT NOT NULL,
    "vessel_id"     TEXT NOT NULL,
    "inspected_at"  TIMESTAMP(3) NOT NULL,
    "kind"          "InspectionKind" NOT NULL,
    "mou"           TEXT,
    "port"          TEXT NOT NULL,
    "inspector"     TEXT NOT NULL,
    "deficiencies"  INTEGER NOT NULL DEFAULT 0,
    "detained"      BOOLEAN NOT NULL DEFAULT false,
    "status"        TEXT NOT NULL,
    "findings"      TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    "deleted_at"    TIMESTAMP(3),
    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inspections_tenant_id_vessel_id_inspected_at_idx" ON "inspections"("tenant_id", "vessel_id", "inspected_at");
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── jhas ─────────────────────────────────────────────────────────────────────

CREATE TABLE "jhas" (
    "id"          TEXT NOT NULL,
    "tenant_id"   TEXT NOT NULL,
    "ref"         TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "activity"    TEXT,
    "hazards"     JSONB NOT NULL,
    "controls"    JSONB NOT NULL,
    "residual_l"  INTEGER NOT NULL DEFAULT 1,
    "residual_s"  INTEGER NOT NULL DEFAULT 1,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    "deleted_at"  TIMESTAMP(3),
    CONSTRAINT "jhas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "jhas_tenant_id_ref_idx" ON "jhas"("tenant_id", "ref");
ALTER TABLE "jhas" ADD CONSTRAINT "jhas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── safety_equipment ─────────────────────────────────────────────────────────

CREATE TABLE "safety_equipment" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "vessel_id"  TEXT NOT NULL,
    "category"   "SafetyEquipmentCategory" NOT NULL,
    "name"       TEXT NOT NULL,
    "location"   TEXT NOT NULL,
    "quantity"   TEXT NOT NULL,
    "last_check" TIMESTAMP(3),
    "next_check" TIMESTAMP(3),
    "status"     "SafetyEquipmentStatus" NOT NULL DEFAULT 'GREEN',
    "flag"       TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "safety_equipment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "safety_equipment_tenant_id_vessel_id_category_idx" ON "safety_equipment"("tenant_id", "vessel_id", "category");
ALTER TABLE "safety_equipment" ADD CONSTRAINT "safety_equipment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "safety_equipment" ADD CONSTRAINT "safety_equipment_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── qhse_objectives ──────────────────────────────────────────────────────────

CREATE TABLE "qhse_objectives" (
    "id"          TEXT NOT NULL,
    "tenant_id"   TEXT NOT NULL,
    "category"    "QhseObjectiveCategory" NOT NULL,
    "label"       TEXT NOT NULL,
    "target"      TEXT NOT NULL,
    "actual"      TEXT NOT NULL,
    "unit"        TEXT NOT NULL,
    "status"      "QhseObjectiveStatus" NOT NULL DEFAULT 'GREEN',
    "delta"       TEXT,
    "trend"       JSONB,
    "period_from" TIMESTAMP(3),
    "period_to"   TIMESTAMP(3),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    "deleted_at"  TIMESTAMP(3),
    CONSTRAINT "qhse_objectives_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "qhse_objectives_tenant_id_category_idx" ON "qhse_objectives"("tenant_id", "category");
ALTER TABLE "qhse_objectives" ADD CONSTRAINT "qhse_objectives_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── audits ───────────────────────────────────────────────────────────────────

CREATE TABLE "audits" (
    "id"           TEXT NOT NULL,
    "tenant_id"    TEXT NOT NULL,
    "vessel_id"    TEXT,
    "kind"         "AuditKind" NOT NULL,
    "scope"        TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "auditor"      TEXT NOT NULL,
    "status"       "AuditStatus" NOT NULL DEFAULT 'SCHEDULED',
    "findings"     INTEGER NOT NULL DEFAULT 0,
    "notes"        TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    "deleted_at"   TIMESTAMP(3),
    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audits_tenant_id_vessel_id_scheduled_at_idx" ON "audits"("tenant_id", "vessel_id", "scheduled_at");
ALTER TABLE "audits" ADD CONSTRAINT "audits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audits" ADD CONSTRAINT "audits_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── audit_findings ───────────────────────────────────────────────────────────

CREATE TABLE "audit_findings" (
    "id"             TEXT NOT NULL,
    "tenant_id"      TEXT NOT NULL,
    "vessel_id"      TEXT NOT NULL,
    "audit_id"       TEXT,
    "classification" TEXT NOT NULL,
    "sms_ref"        TEXT,
    "title"          TEXT NOT NULL,
    "detail"         TEXT,
    "owner"          TEXT,
    "opened_at"      TIMESTAMP(3) NOT NULL,
    "due_at"         TIMESTAMP(3),
    "closed_at"      TIMESTAMP(3),
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    "deleted_at"     TIMESTAMP(3),
    CONSTRAINT "audit_findings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_findings_tenant_id_vessel_id_due_at_idx" ON "audit_findings"("tenant_id", "vessel_id", "due_at");
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── voyage_legs ──────────────────────────────────────────────────────────────

CREATE TABLE "voyage_legs" (
    "id"           TEXT NOT NULL,
    "tenant_id"    TEXT NOT NULL,
    "vessel_id"    TEXT NOT NULL,
    "route"        TEXT NOT NULL,
    "departure_at" TIMESTAMP(3) NOT NULL,
    "arrival_at"   TIMESTAMP(3) NOT NULL,
    "nm"           DECIMAL(12,2) NOT NULL,
    "fuel_tonnes"  DECIMAL(12,3) NOT NULL,
    "co2_tonnes"   DECIMAL(12,3) NOT NULL,
    "sox_tonnes"   DECIMAL(12,3) NOT NULL,
    "nox_tonnes"   DECIMAL(12,3) NOT NULL,
    "hours"        DECIMAL(8,2)  NOT NULL,
    "mode"         "VoyageMode" NOT NULL,
    "cargo"        TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    "deleted_at"   TIMESTAMP(3),
    CONSTRAINT "voyage_legs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "voyage_legs_tenant_id_vessel_id_departure_at_idx" ON "voyage_legs"("tenant_id", "vessel_id", "departure_at");
ALTER TABLE "voyage_legs" ADD CONSTRAINT "voyage_legs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voyage_legs" ADD CONSTRAINT "voyage_legs_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── discharge_logs ───────────────────────────────────────────────────────────

CREATE TABLE "discharge_logs" (
    "id"          TEXT NOT NULL,
    "tenant_id"   TEXT NOT NULL,
    "vessel_id"   TEXT NOT NULL,
    "kind"        TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "location"    TEXT NOT NULL,
    "volume"      TEXT NOT NULL,
    "notes"       TEXT,
    "compliant"   BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    "deleted_at"  TIMESTAMP(3),
    CONSTRAINT "discharge_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "discharge_logs_tenant_id_vessel_id_occurred_at_idx" ON "discharge_logs"("tenant_id", "vessel_id", "occurred_at");
ALTER TABLE "discharge_logs" ADD CONSTRAINT "discharge_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "discharge_logs" ADD CONSTRAINT "discharge_logs_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── drybms_elements ──────────────────────────────────────────────────────────

CREATE TABLE "drybms_elements" (
    "id"            TEXT NOT NULL,
    "tenant_id"     TEXT NOT NULL,
    "chapter"       TEXT NOT NULL,
    "chapter_title" TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "score"         INTEGER NOT NULL DEFAULT 1,
    "stage"         TEXT,
    "evidence"      TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    "deleted_at"    TIMESTAMP(3),
    CONSTRAINT "drybms_elements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "drybms_elements_tenant_id_chapter_idx" ON "drybms_elements"("tenant_id", "chapter");
ALTER TABLE "drybms_elements" ADD CONSTRAINT "drybms_elements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── management_reviews ───────────────────────────────────────────────────────

CREATE TABLE "management_reviews" (
    "id"            TEXT NOT NULL,
    "tenant_id"     TEXT NOT NULL,
    "kind"          TEXT NOT NULL,
    "scheduled_at"  TIMESTAMP(3) NOT NULL,
    "chair"         TEXT NOT NULL,
    "attendees"     INTEGER NOT NULL DEFAULT 0,
    "status"        "ManagementReviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "actions_total" INTEGER NOT NULL DEFAULT 0,
    "actions_done"  INTEGER NOT NULL DEFAULT 0,
    "summary"       TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    "deleted_at"    TIMESTAMP(3),
    CONSTRAINT "management_reviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "management_reviews_tenant_id_scheduled_at_idx" ON "management_reviews"("tenant_id", "scheduled_at");
ALTER TABLE "management_reviews" ADD CONSTRAINT "management_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── RLS policies ─────────────────────────────────────────────────────────────
-- Mirror the existing project pattern: USING tenant_id = current_setting('app.tenant_id', true).

ALTER TABLE "surveys"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conditions_of_class" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inspections"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jhas"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "safety_equipment"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "qhse_objectives"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audits"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_findings"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voyage_legs"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discharge_logs"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "drybms_elements"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "management_reviews"  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "surveys_tenant_isolation"             ON "surveys"             USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "conditions_of_class_tenant_isolation" ON "conditions_of_class" USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "inspections_tenant_isolation"         ON "inspections"         USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "jhas_tenant_isolation"                ON "jhas"                USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "safety_equipment_tenant_isolation"    ON "safety_equipment"    USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "qhse_objectives_tenant_isolation"     ON "qhse_objectives"     USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "audits_tenant_isolation"              ON "audits"              USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "audit_findings_tenant_isolation"      ON "audit_findings"      USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "voyage_legs_tenant_isolation"         ON "voyage_legs"         USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "discharge_logs_tenant_isolation"      ON "discharge_logs"      USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "drybms_elements_tenant_isolation"     ON "drybms_elements"     USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY "management_reviews_tenant_isolation"  ON "management_reviews"  USING (tenant_id = current_setting('app.tenant_id', true));
