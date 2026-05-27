-- H5: refresh-token session tracking + revocation
--
-- Before this migration a leaked 30-day refresh token couldn't be invalidated
-- short of rotating JWT_PRIVATE_KEY_PATH (which logs everyone out). Now every
-- refresh token mint inserts a row here; refresh checks the row exists +
-- isn't revoked, then marks it revoked and inserts the new jti's row.
--
-- Reuse detection: if a refresh comes in with a jti already marked revoked,
-- AuthService stamps `revoked_at` on every outstanding row for that user
-- (the "wholesale revoke" path). The attacker loses access immediately.

CREATE TABLE "refresh_token_sessions" (
  "jti" VARCHAR(26) PRIMARY KEY,
  "tenant_id" TEXT,
  "user_id" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "revoked_reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "refresh_token_sessions_user_id_revoked_at_idx"
  ON "refresh_token_sessions" ("user_id", "revoked_at");
CREATE INDEX "refresh_token_sessions_expires_at_idx"
  ON "refresh_token_sessions" ("expires_at");

-- RLS — same shape as the rest of the codebase. Super-admin bypass when
-- app.current_tenant_id is unset/''; tenants see only their own rows.
-- Super-admin sessions (tenant_id IS NULL) only show up in the bypass
-- context, which is correct: tenant admins can't revoke a super-admin.

ALTER TABLE "refresh_token_sessions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refresh_token_sessions_tenant_isolation" ON "refresh_token_sessions"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );
