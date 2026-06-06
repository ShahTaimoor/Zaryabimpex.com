-- Refactor to minimal POS chart: keep 8 essential accounts, deactivate removed defaults

-- Upsert essential accounts (rename/update existing rows where codes match)
INSERT INTO chart_of_accounts (
  account_code, account_name, account_type, account_category,
  normal_balance, is_system_account, is_active, allow_direct_posting, level, parent_account_id
) VALUES
('1000', 'Cash on Hand', 'asset', 'current_assets', 'debit', TRUE, TRUE, TRUE, 0, NULL),
('1001', 'Bank Accounts', 'asset', 'current_assets', 'debit', TRUE, TRUE, TRUE, 0, NULL),
('1100', 'Accounts Receivable', 'asset', 'current_assets', 'debit', TRUE, TRUE, TRUE, 0, NULL),
('1200', 'Inventory', 'asset', 'inventory', 'debit', TRUE, TRUE, TRUE, 0, NULL),
('2000', 'Accounts Payable', 'liability', 'current_liabilities', 'credit', TRUE, TRUE, TRUE, 0, NULL),
('3100', 'Owner Capital', 'equity', 'owner_equity', 'credit', TRUE, TRUE, TRUE, 0, NULL),
('4000', 'Sales Revenue', 'revenue', 'sales_revenue', 'credit', TRUE, TRUE, TRUE, 0, NULL),
('5000', 'Cost of Goods Sold', 'expense', 'cost_of_goods_sold', 'debit', TRUE, TRUE, TRUE, 0, NULL)
ON CONFLICT (account_code) DO UPDATE SET
  account_name = EXCLUDED.account_name,
  account_type = EXCLUDED.account_type,
  account_category = EXCLUDED.account_category,
  normal_balance = EXCLUDED.normal_balance,
  is_system_account = TRUE,
  is_active = TRUE,
  allow_direct_posting = TRUE,
  level = 0,
  parent_account_id = NULL,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

-- Deactivate removed default/static accounts (preserve ledger history)
UPDATE chart_of_accounts
SET is_active = FALSE,
    allow_direct_posting = FALSE,
    parent_account_id = NULL,
    level = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE account_code IN (
  '1300', '1500', '1600',
  '2100', '2120', '2200', '2300', '2500',
  '3000', '3200',
  '4100', '4200',
  '5050', '5100', '5200', '5210', '5220', '5300', '5400', '5430', '5500', '5600'
)
AND deleted_at IS NULL;
