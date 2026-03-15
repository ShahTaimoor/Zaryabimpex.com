-- Migration: Reverse ledger entries for receipts/payments that were deleted before
-- we added ledger reversal on delete. This brings the account_ledger in line with
-- the current state (no active entries for deleted cash/bank receipts and payments).
--
-- Run once. Safe to re-run: only updates rows where reversed_at IS NULL and the
-- source record is deleted.

-- 1. Reverse ledger entries for deleted cash receipts
UPDATE account_ledger al
SET reversed_at = CURRENT_TIMESTAMP
WHERE al.reference_type = 'cash_receipt'
  AND al.reversed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM cash_receipts cr
    WHERE cr.id = al.reference_id AND cr.deleted_at IS NOT NULL
  );

-- 2. Reverse ledger entries for deleted bank receipts
UPDATE account_ledger al
SET reversed_at = CURRENT_TIMESTAMP
WHERE al.reference_type = 'bank_receipt'
  AND al.reversed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM bank_receipts br
    WHERE br.id = al.reference_id AND br.deleted_at IS NOT NULL
  );

-- 3. Reverse ledger entries for deleted cash payments
UPDATE account_ledger al
SET reversed_at = CURRENT_TIMESTAMP
WHERE al.reference_type = 'cash_payment'
  AND al.reversed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM cash_payments cp
    WHERE cp.id = al.reference_id AND cp.deleted_at IS NOT NULL
  );

-- 4. Reverse ledger entries for deleted bank payments
UPDATE account_ledger al
SET reversed_at = CURRENT_TIMESTAMP
WHERE al.reference_type = 'bank_payment'
  AND al.reversed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM bank_payments bp
    WHERE bp.id = al.reference_id AND bp.deleted_at IS NOT NULL
  );
