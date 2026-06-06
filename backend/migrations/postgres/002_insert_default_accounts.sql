-- Insert essential Chart of Accounts for POS operations (flat, no hierarchy)

INSERT INTO chart_of_accounts (
  account_code, account_name, account_type, account_category,
  normal_balance, is_system_account, is_active, allow_direct_posting, level
) VALUES
('1000', 'Cash on Hand', 'asset', 'current_assets', 'debit', TRUE, TRUE, TRUE, 0),
('1001', 'Bank Accounts', 'asset', 'current_assets', 'debit', TRUE, TRUE, TRUE, 0),
('1100', 'Accounts Receivable', 'asset', 'current_assets', 'debit', TRUE, TRUE, TRUE, 0),
('1200', 'Inventory', 'asset', 'inventory', 'debit', TRUE, TRUE, TRUE, 0),
('2000', 'Accounts Payable', 'liability', 'current_liabilities', 'credit', TRUE, TRUE, TRUE, 0),
('3100', 'Owner Capital', 'equity', 'owner_equity', 'credit', TRUE, TRUE, TRUE, 0),
('4000', 'Sales Revenue', 'revenue', 'sales_revenue', 'credit', TRUE, TRUE, TRUE, 0),
('5000', 'Cost of Goods Sold', 'expense', 'cost_of_goods_sold', 'debit', TRUE, TRUE, TRUE, 0)
ON CONFLICT (account_code) DO NOTHING;
