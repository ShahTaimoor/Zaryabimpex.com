-- Liability used when you accrue amounts owed to investors on the ledger (optional).
-- Payouts default to debiting Retained Earnings (3100) unless API sends another equity/liability code.
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_category, normal_balance, is_system_account, is_active, allow_direct_posting)
VALUES ('2350', 'Due to Investors', 'liability', 'current_liabilities', 'credit', TRUE, TRUE, TRUE)
ON CONFLICT (account_code) DO NOTHING;

ALTER TABLE investor_payouts
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10) NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'bank')),
  ADD COLUMN IF NOT EXISTS debit_account_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ledger_transaction_id VARCHAR(120);
