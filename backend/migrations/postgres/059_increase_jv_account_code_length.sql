-- Increase account_code length to 50 in journal_voucher_entries
-- This resolves 'value too long' errors when using party-specific accounts (CUST-, SUPP-)
-- which often exceed the previous 20-character limit.

ALTER TABLE journal_voucher_entries
  ALTER COLUMN account_code TYPE VARCHAR(50);
