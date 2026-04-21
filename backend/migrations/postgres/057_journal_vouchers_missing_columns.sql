-- Add missing audit columns to journal_vouchers
-- These were defined in 054_journal_vouchers.sql but skipped if the table pre-existed

ALTER TABLE journal_vouchers
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reversed_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reversed_by UUID,
  ADD COLUMN IF NOT EXISTS reversal_of_jv_id UUID REFERENCES journal_vouchers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
