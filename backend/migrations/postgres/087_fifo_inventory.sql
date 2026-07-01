-- FIFO inventory costing: extend existing batches schema, allocations, and batch ledger

-- Legacy installs (085_fifo_inventory_batches.sql) use quantity_received / quantity_remaining / source_type / status
CREATE TABLE IF NOT EXISTS inventory_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID REFERENCES warehouses(id),
    source_type VARCHAR(50),
    source_id UUID,
    supplier_id UUID REFERENCES suppliers(id),
    purchase_date TIMESTAMP,
    unit_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
    quantity_received DECIMAL(15, 4) NOT NULL DEFAULT 0,
    quantity_remaining DECIMAL(15, 4) NOT NULL DEFAULT 0,
    total_cost_received DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id);
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_product_fifo
    ON inventory_batches (product_id, purchase_date ASC NULLS LAST, created_at ASC)
    WHERE quantity_remaining > 0 AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_inventory_batches_source
    ON inventory_batches (source_type, source_id);

CREATE TABLE IF NOT EXISTS sale_batch_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL,
    sale_item_index INTEGER NOT NULL DEFAULT 0,
    product_id UUID NOT NULL REFERENCES products(id),
    inventory_batch_id UUID NOT NULL REFERENCES inventory_batches(id),
    quantity DECIMAL(15, 4) NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(15, 4) NOT NULL CHECK (unit_cost >= 0),
    total_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE sale_batch_allocations ADD COLUMN IF NOT EXISTS quantity_restored DECIMAL(15, 4) NOT NULL DEFAULT 0;
ALTER TABLE sale_batch_allocations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_sale_batch_allocations_sale
    ON sale_batch_allocations (sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_batch_allocations_product
    ON sale_batch_allocations (product_id, sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_batch_allocations_batch
    ON sale_batch_allocations (inventory_batch_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    inventory_batch_id UUID REFERENCES inventory_batches(id),
    movement_type VARCHAR(50) NOT NULL,
    quantity_in DECIMAL(15, 4) NOT NULL DEFAULT 0,
    quantity_out DECIMAL(15, 4) NOT NULL DEFAULT 0,
    remaining_quantity DECIMAL(15, 4),
    unit_cost DECIMAL(15, 4),
    total_cost DECIMAL(15, 2),
    reference_type VARCHAR(50),
    reference_id UUID,
    reference_number VARCHAR(100),
    user_id UUID,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product
    ON inventory_movements (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_batch
    ON inventory_movements (inventory_batch_id)
    WHERE inventory_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference
    ON inventory_movements (reference_type, reference_id);

-- Opening balance batches from current on-hand stock (legacy column names)
INSERT INTO inventory_batches (
    product_id,
    purchase_date,
    quantity_received,
    quantity_remaining,
    unit_cost,
    status,
    source_type,
    created_at,
    updated_at
)
SELECT
    p.id,
    COALESCE(p.created_at, CURRENT_TIMESTAMP),
    GREATEST(COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0), 0),
    GREATEST(COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0), 0),
    GREATEST(COALESCE(p.cost_price, 0), 0),
    'active',
    'opening_balance',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM products p
LEFT JOIN inventory i ON i.product_id = p.id AND i.deleted_at IS NULL
LEFT JOIN (
    SELECT product_id, SUM(quantity) AS quantity
    FROM inventory_balance
    GROUP BY product_id
) ib ON ib.product_id = p.id
WHERE (p.is_deleted = FALSE OR p.is_deleted IS NULL)
  AND (p.is_active = TRUE OR p.is_active IS NULL)
  AND GREATEST(COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0), 0) > 0
  AND NOT EXISTS (
      SELECT 1 FROM inventory_batches b WHERE b.product_id = p.id
  );
