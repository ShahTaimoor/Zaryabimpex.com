-- Migration 047: Add minimal import reference fields for customs/FBR workflows

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS import_ref_no VARCHAR(120),
  ADD COLUMN IF NOT EXISTS gd_number VARCHAR(120),
  ADD COLUMN IF NOT EXISTS invoice_ref VARCHAR(120);

