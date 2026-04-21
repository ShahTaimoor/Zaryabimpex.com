-- Normalize all account codes to uppercase to prevent foreign key violations
-- We must drop constraints temporarily because Postgres doesn't support 
-- deferred constraints for these columns by default.

BEGIN;

-- 1. Drop constraints
ALTER TABLE journal_voucher_entries 
  DROP CONSTRAINT IF EXISTS journal_voucher_entries_account_code_fkey;
ALTER TABLE account_ledger 
  DROP CONSTRAINT IF EXISTS account_ledger_account_code_fkey;

-- 2. Update all tables
UPDATE chart_of_accounts SET account_code = UPPER(account_code);
UPDATE journal_voucher_entries SET account_code = UPPER(account_code);
UPDATE account_ledger SET account_code = UPPER(account_code);

-- 3. Re-add constraints
ALTER TABLE journal_voucher_entries 
  ADD CONSTRAINT journal_voucher_entries_account_code_fkey 
  FOREIGN KEY (account_code) REFERENCES chart_of_accounts(account_code) ON DELETE RESTRICT;

ALTER TABLE account_ledger 
  ADD CONSTRAINT account_ledger_account_code_fkey 
  FOREIGN KEY (account_code) REFERENCES chart_of_accounts(account_code);

COMMIT;
