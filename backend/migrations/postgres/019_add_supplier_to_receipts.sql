-- Add supplier_id column to cash_receipts, bank_receipts, cash_payments, and bank_payments tables
-- This allows receipts and payments to be associated with suppliers in addition to customers

-- Add supplier_id to cash_receipts
ALTER TABLE cash_receipts 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- Add index for supplier_id in cash_receipts
CREATE INDEX IF NOT EXISTS idx_cash_receipts_supplier ON cash_receipts(supplier_id) WHERE supplier_id IS NOT NULL;

-- Add supplier_id to bank_receipts
ALTER TABLE bank_receipts 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- Add index for supplier_id in bank_receipts
CREATE INDEX IF NOT EXISTS idx_bank_receipts_supplier ON bank_receipts(supplier_id) WHERE supplier_id IS NOT NULL;

-- Add supplier_id to cash_payments (if not already exists)
ALTER TABLE cash_payments 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- Add index for supplier_id in cash_payments
CREATE INDEX IF NOT EXISTS idx_cash_payments_supplier ON cash_payments(supplier_id) WHERE supplier_id IS NOT NULL;

-- Add supplier_id to bank_payments (if not already exists)
ALTER TABLE bank_payments 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- Add index for supplier_id in bank_payments (if not already exists)
CREATE INDEX IF NOT EXISTS idx_bank_payments_supplier ON bank_payments(supplier_id) WHERE supplier_id IS NOT NULL;
