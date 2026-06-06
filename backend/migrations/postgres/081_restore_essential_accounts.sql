-- Restore essential POS accounts that were soft-deleted but still required for sales/purchases/ledger posting

UPDATE chart_of_accounts
SET deleted_at = NULL,
    is_active = TRUE,
    allow_direct_posting = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE account_code IN ('1000', '1001', '1100', '1200', '2000', '3100', '4000', '5000')
  AND deleted_at IS NOT NULL;
