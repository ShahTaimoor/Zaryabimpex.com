-- Migration: Reverse ledger entries for purchase invoices that were deleted before
-- we added ledger reversal on delete. This brings the account_ledger in line with
-- the current state (no active entries for deleted purchase invoices).
--
-- Run once. Safe to re-run: only updates rows where reversed_at IS NULL and the
-- source purchase_invoices row has deleted_at IS NOT NULL.

-- 1. Reverse ledger entries for deleted purchase invoices (invoice posting)
UPDATE account_ledger al
SET reversed_at = CURRENT_TIMESTAMP
WHERE al.reference_type = 'purchase_invoice'
  AND al.reversed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM purchase_invoices pi
    WHERE pi.id = al.reference_id AND pi.deleted_at IS NOT NULL
  );

-- 2. Reverse ledger entries for deleted purchase invoice payments
UPDATE account_ledger al
SET reversed_at = CURRENT_TIMESTAMP
WHERE al.reference_type = 'purchase_invoice_payment'
  AND al.reversed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM purchase_invoices pi
    WHERE pi.id = al.reference_id AND pi.deleted_at IS NOT NULL
  );
