-- Add supplier_type and rating columns to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_type VARCHAR(50) DEFAULT 'other';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 3;
