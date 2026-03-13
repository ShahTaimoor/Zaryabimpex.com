-- Batches table for expiryManagementService (FEFO, expiry write-off)
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    batch_number VARCHAR(100) NOT NULL,
    lot_number VARCHAR(100),
    initial_quantity DECIMAL(15, 3) NOT NULL CHECK (initial_quantity >= 0),
    current_quantity DECIMAL(15, 3) NOT NULL CHECK (current_quantity >= 0),
    unit_cost DECIMAL(15, 4) NOT NULL CHECK (unit_cost >= 0),
    total_cost DECIMAL(15, 2) NOT NULL CHECK (total_cost >= 0),
    manufacture_date TIMESTAMP,
    expiry_date TIMESTAMP,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    supplier_id UUID,
    purchase_invoice_id UUID,
    purchase_order_id UUID,
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'quarantined', 'recalled', 'expired', 'depleted')),
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_status_expiry ON batches(status, expiry_date);
