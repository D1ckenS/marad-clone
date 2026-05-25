-- Backfill `audits.findings` from
-- `COUNT(audit_findings WHERE audit_id = X AND deleted_at IS NULL)`.
-- Mirrors the shore-side migration 20260526000000_backfill_audit_findings.
-- See AuditFindingService.recomputeAuditFindings for the going-forward
-- consistency mechanism.

UPDATE audits
SET findings = COALESCE(
  (SELECT COUNT(*)
     FROM audit_findings
    WHERE audit_id = audits.id
      AND deleted_at IS NULL),
  0
);
