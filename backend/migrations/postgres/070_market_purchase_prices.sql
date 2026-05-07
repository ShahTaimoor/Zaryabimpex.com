CREATE TABLE IF NOT EXISTS market_price_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'previewed',
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_report JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS market_purchase_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  purchase_price NUMERIC(14,4) NOT NULL CHECK (purchase_price >= 0),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(30) NOT NULL DEFAULT 'manual',
  import_batch_id UUID NULL REFERENCES market_price_import_batches(id) ON DELETE SET NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market_price_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_purchase_price NUMERIC(14,4),
  new_purchase_price NUMERIC(14,4) NOT NULL,
  effective_date DATE NOT NULL,
  source VARCHAR(30) NOT NULL,
  import_batch_id UUID NULL REFERENCES market_price_import_batches(id) ON DELETE SET NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_purchase_prices_product_effective
  ON market_purchase_prices (product_id, effective_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_price_change_log_created
  ON market_price_change_log (created_at DESC);
