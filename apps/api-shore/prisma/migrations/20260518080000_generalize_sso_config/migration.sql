-- Generalize tenant_sso_configs to support multiple OIDC providers (ENTRA + GOOGLE).

CREATE TYPE "SsoProvider" AS ENUM ('ENTRA', 'GOOGLE');

ALTER TABLE "tenant_sso_configs"
  ADD COLUMN "provider"       "SsoProvider",
  ADD COLUMN "discovery_url"  TEXT,
  ADD COLUMN "client_id"      TEXT;

UPDATE "tenant_sso_configs"
SET
  provider      = 'ENTRA',
  discovery_url = 'https://login.microsoftonline.com/' || entra_tenant_id || '/v2.0',
  client_id     = entra_client_id;

ALTER TABLE "tenant_sso_configs"
  ALTER COLUMN "provider"      SET NOT NULL,
  ALTER COLUMN "discovery_url" SET NOT NULL,
  ALTER COLUMN "client_id"     SET NOT NULL;

DROP INDEX IF EXISTS "tenant_sso_configs_tenant_id_key";

ALTER TABLE "tenant_sso_configs"
  ADD CONSTRAINT "tenant_sso_configs_tenant_id_provider_key" UNIQUE ("tenant_id", "provider");

ALTER TABLE "tenant_sso_configs"
  DROP COLUMN "entra_client_id",
  DROP COLUMN "entra_tenant_id";
