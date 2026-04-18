-- Hot paths: list/report queries use deleted_at IS NULL plus date or sale_date / created_at ranges.
-- Partial indexes are smaller than full-table indexes and match those predicates.

CREATE INDEX IF NOT EXISTS idx_sales_sale_date_active ON sales (sale_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_created_at_active ON sales (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_customer_sale_date_active ON sales (customer_id, sale_date DESC)
  WHERE deleted_at IS NULL AND customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_orders_created_at_active ON sales_orders (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cash_receipts_date_active ON cash_receipts (date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cash_payments_date_active ON cash_payments (date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bank_receipts_date_active ON bank_receipts (date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bank_payments_date_active ON bank_payments (date DESC)
  WHERE deleted_at IS NULL;
