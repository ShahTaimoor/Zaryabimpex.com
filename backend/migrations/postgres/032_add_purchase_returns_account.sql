-- Add Purchase Returns account (5050) - contra-COGS, credit normal balance
-- Used when posting purchase return transactions (reduces cost of goods sold)
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_category, normal_balance, is_system_account, is_active, allow_direct_posting, description) VALUES
('5050', 'Purchase Returns', 'expense', 'cost_of_goods_sold', 'credit', TRUE, TRUE, TRUE, 'Contra-COGS: returns of inventory to suppliers')
ON CONFLICT (account_code) DO NOTHING;
