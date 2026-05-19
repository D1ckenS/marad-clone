-- CreateIndex
CREATE INDEX "certificates_tenant_id_expires_at_vessel_id_idx" ON "certificates"("tenant_id", "expires_at", "vessel_id");
