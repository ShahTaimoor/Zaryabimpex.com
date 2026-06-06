-- Location-scoped inventory: warehouse bulk stock, shop sellable stock, transfers

CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(500),
    address JSONB,
    contact JSONB,
    notes VARCHAR(1000),
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_shops_is_active ON shops(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shops_is_primary ON shops(is_primary) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS warehouse_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(15, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity DECIMAL(15, 3) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (warehouse_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse ON warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_product ON warehouse_stock(product_id);

CREATE TABLE IF NOT EXISTS shop_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(15, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity DECIMAL(15, 3) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (shop_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_stock_shop ON shop_stock(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_stock_product ON shop_stock(product_id);

CREATE TABLE IF NOT EXISTS stock_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_number VARCHAR(50) NOT NULL UNIQUE,
    from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    to_shop_id UUID NOT NULL REFERENCES shops(id),
    status VARCHAR(20) NOT NULL DEFAULT 'completed'
        CHECK (status IN ('draft', 'completed', 'cancelled')),
    notes TEXT,
    transferred_by UUID,
    transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_warehouse ON stock_transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_shop ON stock_transfers(to_shop_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_transferred_at ON stock_transfers(transferred_at DESC);

CREATE TABLE IF NOT EXISTS stock_transfer_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(15, 4),
    UNIQUE (transfer_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_lines_transfer ON stock_transfer_lines(transfer_id);

-- Default primary shop
INSERT INTO shops (name, code, description, is_primary, is_active)
SELECT 'Main Shop', 'SHOP-001', 'Default retail shop', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM shops WHERE deleted_at IS NULL);

-- Backfill shop stock from existing global inventory (sellable stock stays at shop)
INSERT INTO shop_stock (shop_id, product_id, quantity)
SELECT s.id, i.product_id, GREATEST(COALESCE(i.current_stock, 0), 0)
FROM shops s
JOIN inventory i ON i.deleted_at IS NULL
WHERE s.is_primary = TRUE AND s.deleted_at IS NULL
ON CONFLICT (shop_id, product_id) DO NOTHING;
