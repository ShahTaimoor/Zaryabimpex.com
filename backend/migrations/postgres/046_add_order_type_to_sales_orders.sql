-- Add order_type to sales_orders (retail/wholesale/return/exchange)
-- Needed so when confirming a Sales Order and generating a Sales invoice,
-- the invoice can preserve the same pricing mode.

ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'retail';

UPDATE sales_orders
SET order_type = 'retail'
WHERE order_type IS NULL;

