-- Migration to add client_side_id to various transaction tables for offline sync support
-- This allows idempotent synchronization from the frontend PWA.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_side_id UUID UNIQUE;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS client_side_id UUID UNIQUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS client_side_id UUID UNIQUE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS client_side_id UUID UNIQUE;
ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS client_side_id UUID UNIQUE;
ALTER TABLE bank_receipts ADD COLUMN IF NOT EXISTS client_side_id UUID UNIQUE;
ALTER TABLE cash_payments ADD COLUMN IF NOT EXISTS client_side_id UUID UNIQUE;
ALTER TABLE bank_payments ADD COLUMN IF NOT EXISTS client_side_id UUID UNIQUE;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS client_side_id UUID UNIQUE;

-- Create indexes for faster lookups during sync
CREATE INDEX IF NOT EXISTS idx_sales_client_side_id ON sales(client_side_id) WHERE client_side_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_client_side_id ON purchases(client_side_id) WHERE client_side_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_client_side_id ON customers(client_side_id) WHERE client_side_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_client_side_id ON suppliers(client_side_id) WHERE client_side_id IS NOT NULL;
