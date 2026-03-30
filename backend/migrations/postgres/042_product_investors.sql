-- Links investors to products with profit share % (PostgreSQL; replaces embedded Mongo subdocs)

CREATE TABLE IF NOT EXISTS product_investors (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
    share_percentage DECIMAL(5, 2) NOT NULL DEFAULT 30 CHECK (share_percentage >= 0 AND share_percentage <= 100),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_product_investors_investor_id ON product_investors(investor_id);
