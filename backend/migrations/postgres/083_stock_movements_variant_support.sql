-- Allow stock_movements.product_id to reference variants (same pattern as inventory table)

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey;

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS product_model VARCHAR(50) NOT NULL DEFAULT 'Product'
  CHECK (product_model IN ('Product', 'ProductVariant'));

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_model
  ON stock_movements(product_id, product_model);
