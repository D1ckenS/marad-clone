-- Parts are now vessel-scoped. Each vessel maintains its own parts list.
ALTER TABLE parts ADD COLUMN IF NOT EXISTS vessel_id TEXT REFERENCES vessels(id);
CREATE INDEX IF NOT EXISTS parts_tenant_vessel_idx ON parts(tenant_id, vessel_id);
