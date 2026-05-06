-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "hlc" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "hlc" TEXT;

-- AlterTable
ALTER TABLE "vessels" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "hlc" TEXT;

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB,
    "hlc" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_records" (
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "hlc" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "fields" JSONB NOT NULL,

    CONSTRAINT "sync_records_pkey" PRIMARY KEY ("tenant_id","vessel_id","entity_type","entity_id")
);

-- CreateIndex
CREATE INDEX "outbox_pending_idx" ON "outbox"("tenant_id", "vessel_id", "sent_at", "created_at");

-- RLS for sync tables. The `marad` role is table owner and bypasses RLS;
-- a future least-privilege application role will be subject to these policies.
ALTER TABLE "outbox" ENABLE ROW LEVEL SECURITY;
CREATE POLICY outbox_tenant_isolation ON "outbox"
  USING (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE "sync_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY sync_records_tenant_isolation ON "sync_records"
  USING (tenant_id = current_setting('app.current_tenant_id', true));
