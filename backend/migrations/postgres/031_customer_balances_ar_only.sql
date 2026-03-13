-- Fix customer_balances view to only include AR (1100) entries
-- Previously it included ALL ledger entries with customer_id (including Sales Returns account),
-- which caused Sale Return to not reduce customer balance (Dr Sales Returns offset Cr AR).
-- Customer receivable balance should only reflect AR account (1100) entries.
CREATE OR REPLACE VIEW customer_balances AS
SELECT 
    c.id,
    c.business_name,
    c.opening_balance,
    COALESCE(SUM(ledger.debit_amount - ledger.credit_amount), 0) AS ledger_balance,
    (c.opening_balance + COALESCE(SUM(ledger.debit_amount - ledger.credit_amount), 0)) AS current_balance
FROM customers c
LEFT JOIN account_ledger ledger ON c.id = ledger.customer_id 
    AND ledger.account_code = '1100'
    AND ledger.status = 'completed' 
    AND ledger.reversed_at IS NULL
GROUP BY c.id, c.business_name, c.opening_balance;

-- Fix supplier_balances view to only include AP (2000) entries
-- Previously it included ALL ledger entries with supplier_id (including Purchase Returns account),
-- which caused Purchase Return to not reduce supplier balance (Cr Purchase Returns offset Dr AP).
-- Supplier payable balance should only reflect AP account (2000) entries.
CREATE OR REPLACE VIEW supplier_balances AS
SELECT 
    s.id,
    s.company_name,
    s.opening_balance,
    COALESCE(SUM(ledger.credit_amount - ledger.debit_amount), 0) AS ledger_balance,
    (s.opening_balance + COALESCE(SUM(ledger.credit_amount - ledger.debit_amount), 0)) AS current_balance
FROM suppliers s
LEFT JOIN account_ledger ledger ON s.id = ledger.supplier_id 
    AND ledger.account_code = '2000'
    AND ledger.status = 'completed' 
    AND ledger.reversed_at IS NULL
GROUP BY s.id, s.company_name, s.opening_balance;
