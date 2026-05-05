-- Enable Row-Level Security on all tenant-scoped tables.
-- The application sets app.current_tenant_id on every connection before
-- executing queries (see PrismaService). SUPER_ADMIN bypasses RLS entirely.

-- vessels ─────────────────────────────────────────────────────────────────────
ALTER TABLE "vessels" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vessels_tenant_isolation" ON "vessels"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

-- users ───────────────────────────────────────────────────────────────────────
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_tenant_isolation" ON "users"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );
