-- Search/list performance indexes (ILIKE + pagination)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON products USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_barcode_trgm ON products USING gin (barcode gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_active_name ON products (is_active, name) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_customers_business_name_trgm ON customers USING gin (business_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm ON customers USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_suppliers_company_name_trgm ON suppliers USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_suppliers_business_name_trgm ON suppliers USING gin (business_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_banks_bank_name_trgm ON banks USING gin (bank_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_banks_account_name_trgm ON banks USING gin (account_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_banks_account_number_trgm ON banks USING gin (account_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_code_trgm ON chart_of_accounts USING gin (account_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_name_trgm ON chart_of_accounts USING gin (account_name gin_trgm_ops);
