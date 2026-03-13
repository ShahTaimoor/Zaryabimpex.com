-- Add Bank account (1001) - used for bank receipts, bank payments, and balance sheet
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_category, normal_balance, is_system_account, is_active) VALUES
('1001', 'Bank', 'asset', 'current_assets', 'debit', TRUE, TRUE)
ON CONFLICT (account_code) DO NOTHING;
