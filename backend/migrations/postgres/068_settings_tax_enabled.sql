-- Global GST/VAT toggle: when false, no tax is applied server-side (see utils/globalTax.js).
ALTER TABLE settings ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT FALSE;
