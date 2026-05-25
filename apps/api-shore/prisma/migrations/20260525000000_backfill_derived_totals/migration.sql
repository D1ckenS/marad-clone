-- Backfill `total_amount` on purchase_orders, quotes, requisitions from
-- their respective line tables so the denormalised parent total matches
-- SUM(line.total_price) at the moment this migration runs.
--
-- Prior to this migration `total_amount` was a writable field on each
-- parent, which let clients (and the Quote→PO converter) persist a total
-- that didn't reconcile with the line rows. Going forward the service
-- layer recomputes the parent's `total_amount` on every addLine call —
-- this migration is the one-shot reconciliation for rows that already
-- exist.

-- ── purchase_orders ───────────────────────────────────────────────────
UPDATE purchase_orders po
SET total_amount = COALESCE(
  (SELECT SUM(total_price)
     FROM po_lines
    WHERE po_id = po.id
      AND deleted_at IS NULL),
  0
);

-- ── quotes ────────────────────────────────────────────────────────────
UPDATE quotes q
SET total_amount = COALESCE(
  (SELECT SUM(total_price)
     FROM quote_lines
    WHERE quote_id = q.id
      AND deleted_at IS NULL),
  0
);

-- ── requisitions ──────────────────────────────────────────────────────
-- Requisition lines store an estimate (nullable), so we sum
-- `estimated_total_price` and let NULLs contribute 0 implicitly.
UPDATE requisitions r
SET total_amount = COALESCE(
  (SELECT SUM(estimated_total_price)
     FROM requisition_lines
    WHERE requisition_id = r.id
      AND deleted_at IS NULL),
  0
);
