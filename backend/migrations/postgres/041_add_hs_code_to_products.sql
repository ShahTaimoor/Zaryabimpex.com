-- HS (Harmonized System) code for customs / trade classification (store national extensions as text)
ALTER TABLE products ADD COLUMN IF NOT EXISTS hs_code VARCHAR(32);

COMMENT ON COLUMN products.hs_code IS 'Harmonized System tariff code for import/export classification';
