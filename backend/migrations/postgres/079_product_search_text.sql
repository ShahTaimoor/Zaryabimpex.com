-- Compact normalized name for flexible product search (spacing / x-notation insensitive)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE products ADD COLUMN IF NOT EXISTS search_text text
  GENERATED ALWAYS AS (
    regexp_replace(
      regexp_replace(lower(trim(COALESCE(name, ''))), '\s+', ' ', 'g'),
      '[^a-z0-9]', '', 'g'
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_search_text_trgm ON products USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_search_text_prefix ON products (search_text text_pattern_ops)
  WHERE is_deleted = FALSE;
