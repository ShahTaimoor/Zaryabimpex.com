-- Add last_sale_price column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_sale_price DECIMAL(15, 2) DEFAULT 0;
