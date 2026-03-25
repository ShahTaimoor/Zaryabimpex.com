-- Migration 040: Add image_url to products table

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);

-- Also add to product_variants just in case
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);
