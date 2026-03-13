-- Add business_type and customer_tier to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_type VARCHAR(30) DEFAULT 'wholesale' CHECK (business_type IN ('retail', 'wholesale', 'distributor', 'individual'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_tier VARCHAR(20) DEFAULT 'bronze' CHECK (customer_tier IN ('bronze', 'silver', 'gold', 'platinum'));
