-- Allow duplicate SKU values
-- Previously: products.sku had a UNIQUE constraint.
-- This migration drops that unique constraint so the same SKU can exist on multiple products.

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
DROP INDEX IF EXISTS products_sku_key;

