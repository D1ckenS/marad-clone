-- AlterTable
ALTER TABLE "tenant_sso_configs" ALTER COLUMN "provider" SET DEFAULT 'ENTRA';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "last_name" TEXT;
