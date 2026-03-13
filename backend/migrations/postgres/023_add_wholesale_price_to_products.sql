-- Add wholesale_price column to products
-- Default to selling_price for existing rows so wholesale = retail until explicitly set
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(15, 2);

UPDATE products SET wholesale_price = selling_price WHERE wholesale_price IS NULL;

ALTER TABLE products ALTER COLUMN wholesale_price SET DEFAULT 0;
