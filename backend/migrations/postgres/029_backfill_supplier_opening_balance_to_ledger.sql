-- Migration: Backfill supplier opening balances to account_ledger
-- For suppliers with opening_balance != 0 that don't yet have a supplier_opening_balance ledger entry

DO $$
DECLARE
  rec RECORD;
  txn_id TEXT;
  ref_num TEXT;
  amt DECIMAL(15, 2);
BEGIN
  FOR rec IN
    SELECT s.id, s.opening_balance, s.created_at
    FROM suppliers s
    WHERE s.is_deleted = FALSE
      AND COALESCE(s.opening_balance, 0) != 0
      AND NOT EXISTS (
        SELECT 1 FROM account_ledger al
        WHERE al.supplier_id = s.id
          AND al.reference_type = 'supplier_opening_balance'
          AND al.reversed_at IS NULL
      )
  LOOP
    amt := ABS(rec.opening_balance);
    txn_id := 'TXN-OB-' || REPLACE(rec.id::TEXT, '-', '');
    ref_num := 'OB-' || SUBSTRING(rec.id::TEXT, 1, 8);

    IF rec.opening_balance > 0 THEN
      -- Positive: we owe supplier - Credit AP (2000), Debit Retained Earnings (3100)
      INSERT INTO account_ledger (
        transaction_id, transaction_date, account_code,
        debit_amount, credit_amount, description,
        reference_type, reference_id, reference_number,
        supplier_id, currency, status
      ) VALUES
        (txn_id || '-1', rec.created_at, '2000', 0, amt, 'Supplier opening balance (payable)',
         'supplier_opening_balance', rec.id, ref_num,
         rec.id, 'PKR', 'completed'),
        (txn_id || '-2', rec.created_at, '3100', amt, 0, 'Supplier opening balance (equity offset)',
         'supplier_opening_balance', rec.id, ref_num,
         NULL, 'PKR', 'completed');
    ELSE
      -- Negative: advance to supplier - Debit AP (2000), Credit Retained Earnings (3100)
      INSERT INTO account_ledger (
        transaction_id, transaction_date, account_code,
        debit_amount, credit_amount, description,
        reference_type, reference_id, reference_number,
        supplier_id, currency, status
      ) VALUES
        (txn_id || '-1', rec.created_at, '2000', amt, 0, 'Supplier opening balance (advance)',
         'supplier_opening_balance', rec.id, ref_num,
         rec.id, 'PKR', 'completed'),
        (txn_id || '-2', rec.created_at, '3100', 0, amt, 'Supplier opening balance (equity offset)',
         'supplier_opening_balance', rec.id, ref_num,
         NULL, 'PKR', 'completed');
    END IF;
  END LOOP;
END $$;
