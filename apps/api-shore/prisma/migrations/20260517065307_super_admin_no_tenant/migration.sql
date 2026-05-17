-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_tenant_id_fkey";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique index: prevent two SUPER_ADMIN users with the same email.
-- Standard unique constraint allows multiple NULLs in tenant_id; this fills the gap.
CREATE UNIQUE INDEX users_super_admin_email_uniq ON users (email) WHERE tenant_id IS NULL;
