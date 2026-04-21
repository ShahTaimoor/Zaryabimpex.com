-- Add customer and supplier linking to journal voucher entries
-- This allows JVs to be correctly reflected in party-specific ledgers

ALTER TABLE journal_voucher_entries
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- Index for performance when querying per-party ledgers
CREATE INDEX IF NOT EXISTS idx_journal_voucher_entries_customer
  ON journal_voucher_entries(customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journal_voucher_entries_supplier
  ON journal_voucher_entries(supplier_id) WHERE supplier_id IS NOT NULL;
