-- CreateIndex: unique username per tenant
CREATE UNIQUE INDEX "users_tenant_id_username_key" ON "users"("tenant_id", "username");

-- Partial unique index: prevent two SUPER_ADMIN accounts with the same username
CREATE UNIQUE INDEX users_super_admin_username_uniq ON users (username) WHERE tenant_id IS NULL AND username IS NOT NULL;
