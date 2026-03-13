-- Add applied_discounts to sales for discount service (store which discount codes were applied)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS applied_discounts JSONB DEFAULT '[]';
