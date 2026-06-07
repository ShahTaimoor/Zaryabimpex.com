-- Multi-location inventory: location FKs on movements + reporting indexes

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id),
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_id
  ON stock_movements(warehouse_id) WHERE warehouse_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_id
  ON stock_movements(shop_id) WHERE shop_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created
  ON stock_movements(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_warehouse_stock_wh_product
  ON warehouse_stock(warehouse_id, product_id);

CREATE INDEX IF NOT EXISTS idx_shop_stock_shop_product
  ON shop_stock(shop_id, product_id);

CREATE INDEX IF NOT EXISTS idx_products_active_name
  ON products(name) WHERE is_deleted = FALSE;
