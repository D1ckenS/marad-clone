-- Backfill `total_amount` on purchase_orders, quotes, requisitions from
-- their respective line tables so the denormalised parent total matches
-- SUM(line.total_price) at the moment this migration runs. Mirrors the
-- shore-side migration 20260525000000_backfill_derived_totals.
--
-- Going forward the service layer recomputes the parent's total_amount
-- on every addLine / removeLine — this migration only reconciles rows
-- that already exist.

UPDATE purchase_orders
SET total_amount = COALESCE(
  (SELECT SUM(CAST(total_price AS REAL))
     FROM po_lines
    WHERE po_id = purchase_orders.id
      AND deleted_at IS NULL),
  0
);
--> statement-breakpoint
UPDATE quotes
SET total_amount = COALESCE(
  (SELECT SUM(CAST(total_price AS REAL))
     FROM quote_lines
    WHERE quote_id = quotes.id
      AND deleted_at IS NULL),
  0
);
--> statement-breakpoint
UPDATE requisitions
SET total_amount = COALESCE(
  (SELECT SUM(CAST(estimated_total_price AS REAL))
     FROM requisition_lines
    WHERE requisition_id = requisitions.id
      AND deleted_at IS NULL),
  0
);
