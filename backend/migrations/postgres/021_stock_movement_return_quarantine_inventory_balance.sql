-- Allow return_quarantine movement type (non-resellable returns: scrap/quarantine, no inventory increase)
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_movement_type_check CHECK (
  movement_type IN (
    'purchase', 'sale', 'return_in', 'return_out', 'return_quarantine',
    'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out',
    'damage', 'expiry', 'theft', 'production', 'consumption', 'initial_stock'
  )
);

-- inventory_balance: one row per product, updated on every stock-affecting transaction (fast POS)
CREATE TABLE IF NOT EXISTS inventory_balance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  quantity_reserved DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  quantity_quarantine DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (quantity_quarantine >= 0),
  last_movement_id UUID REFERENCES stock_movements(id),
  last_movement_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_balance_product ON inventory_balance(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balance_updated_at ON inventory_balance(updated_at);

COMMENT ON TABLE inventory_balance IS 'Current stock balance per product, updated on every transaction for fast POS reads';

-- Backfill from existing inventory so POS has data immediately
INSERT INTO inventory_balance (product_id, quantity, quantity_reserved, quantity_quarantine, updated_at)
SELECT product_id, COALESCE(current_stock, 0), COALESCE(reserved_stock, 0), 0, COALESCE(last_updated, CURRENT_TIMESTAMP)
FROM inventory
WHERE deleted_at IS NULL
ON CONFLICT (product_id) DO NOTHING;
