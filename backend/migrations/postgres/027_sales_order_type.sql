-- Add order_type column to sales table (retail, wholesale, return, exchange)
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'retail';

-- Set default for existing rows
UPDATE sales SET order_type = 'retail' WHERE order_type IS NULL;
