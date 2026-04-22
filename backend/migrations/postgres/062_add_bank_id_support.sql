-- Migration 062: Add bank_id support to journal voucher entries and account ledger
-- This ensures specific bank accounts are linked to ledger entries for JVs and reports

-- 1. Add bank_id to journal_voucher_entries
ALTER TABLE journal_voucher_entries
  ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES banks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_journal_voucher_entries_bank
  ON journal_voucher_entries(bank_id) WHERE bank_id IS NOT NULL;

-- 2. Add bank_id to account_ledger
ALTER TABLE account_ledger
  ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES banks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_account_ledger_bank
  ON account_ledger(bank_id) WHERE bank_id IS NOT NULL;

-- 3. Backfill bank_id in account_ledger from bank_receipts
UPDATE account_ledger al
SET bank_id = br.bank_id
FROM bank_receipts br
WHERE al.reference_id = br.id 
  AND al.reference_type = 'bank_receipt' 
  AND al.bank_id IS NULL;

-- 4. Backfill bank_id in account_ledger from bank_payments
UPDATE account_ledger al
SET bank_id = bp.bank_id
FROM bank_payments bp
WHERE al.reference_id = bp.id 
  AND al.reference_type = 'bank_payment' 
  AND al.bank_id IS NULL;
