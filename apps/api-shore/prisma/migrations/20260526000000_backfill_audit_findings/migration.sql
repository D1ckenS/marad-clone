-- Backfill `audits.findings` from `COUNT(audit_findings WHERE audit_id = X
-- AND deleted_at IS NULL)`. Mirrors the totalAmount fix in PR #53 — the
-- counter was previously a writable column, so any existing row may
-- carry a stale value. The service layer now keeps it in sync going
-- forward (see `recomputeFindings` called from AuditFindingService
-- create/update/softDelete).

UPDATE audits a
SET findings = COALESCE(
  (SELECT COUNT(*)
     FROM audit_findings
    WHERE audit_id = a.id
      AND deleted_at IS NULL),
  0
);
