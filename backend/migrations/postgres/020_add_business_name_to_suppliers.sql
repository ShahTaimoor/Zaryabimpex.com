-- Add business_name column to suppliers table
-- This allows suppliers to have a business name similar to customers

ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);

-- Add index for business_name in suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_business_name ON suppliers(business_name) WHERE business_name IS NOT NULL;
