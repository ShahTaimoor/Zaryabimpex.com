-- Enable direct posting for Customer and Supplier accounts
-- This allows them to be used in Journal Vouchers for manual adjustments
-- while still correctly updating the sub-ledgers.

UPDATE chart_of_accounts
SET allow_direct_posting = TRUE
WHERE (account_code LIKE 'CUST-%' OR account_code LIKE 'SUPP-%');
