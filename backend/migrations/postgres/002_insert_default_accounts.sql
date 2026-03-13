-- Insert default Chart of Accounts
-- This creates a basic chart of accounts structure

-- Assets
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_category, normal_balance, is_system_account, is_active) VALUES
('1000', 'Cash and Cash Equivalents', 'asset', 'current_assets', 'debit', TRUE, TRUE),
('1100', 'Accounts Receivable', 'asset', 'current_assets', 'debit', TRUE, TRUE),
('1200', 'Inventory', 'asset', 'current_assets', 'debit', TRUE, TRUE),
('1300', 'Prepaid Expenses', 'asset', 'current_assets', 'debit', TRUE, TRUE),
('1500', 'Fixed Assets', 'asset', 'fixed_assets', 'debit', TRUE, TRUE),
('1600', 'Accumulated Depreciation', 'asset', 'fixed_assets', 'credit', TRUE, TRUE),

-- Liabilities
('2000', 'Accounts Payable', 'liability', 'current_liabilities', 'credit', TRUE, TRUE),
('2100', 'Accrued Expenses', 'liability', 'current_liabilities', 'credit', TRUE, TRUE),
('2200', 'Sales Tax Payable', 'liability', 'current_liabilities', 'credit', TRUE, TRUE),
('2300', 'Short Term Debt', 'liability', 'current_liabilities', 'credit', TRUE, TRUE),
('2500', 'Long Term Debt', 'liability', 'long_term_liabilities', 'credit', TRUE, TRUE),

-- Equity
('3000', 'Owner Equity', 'equity', 'owner_equity', 'credit', TRUE, TRUE),
('3100', 'Retained Earnings', 'equity', 'retained_earnings', 'credit', TRUE, TRUE),
('3200', 'Current Year Earnings', 'equity', 'retained_earnings', 'credit', TRUE, TRUE),

-- Revenue
('4000', 'Sales Revenue', 'revenue', 'sales_revenue', 'credit', TRUE, TRUE),
('4100', 'Sales Returns', 'revenue', 'sales_revenue', 'debit', TRUE, TRUE),
('4200', 'Other Income', 'revenue', 'other_revenue', 'credit', TRUE, TRUE),

-- Expenses
('5000', 'Cost of Goods Sold', 'expense', 'cost_of_goods_sold', 'debit', TRUE, TRUE),
('5100', 'Operating Expenses', 'expense', 'operating_expenses', 'debit', TRUE, TRUE),
('5200', 'Salaries and Wages', 'expense', 'operating_expenses', 'debit', TRUE, TRUE),
('5300', 'Rent Expense', 'expense', 'operating_expenses', 'debit', TRUE, TRUE),
('5400', 'Utilities Expense', 'expense', 'operating_expenses', 'debit', TRUE, TRUE),
('5500', 'Depreciation Expense', 'expense', 'operating_expenses', 'debit', TRUE, TRUE),
('5600', 'Other Expenses', 'expense', 'other_expenses', 'debit', TRUE, TRUE)
ON CONFLICT (account_code) DO NOTHING;
