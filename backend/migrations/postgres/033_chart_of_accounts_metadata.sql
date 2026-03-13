-- Add metadata column to chart_of_accounts for customer/supplier account linking
-- Used by queries like: WHERE metadata->>'customerId' = $1
ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_metadata_customer 
  ON chart_of_accounts ((metadata->>'customerId')) 
  WHERE metadata->>'customerId' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_metadata_supplier 
  ON chart_of_accounts ((metadata->>'supplierId')) 
  WHERE metadata->>'supplierId' IS NOT NULL;
