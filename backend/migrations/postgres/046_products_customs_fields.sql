-- Migration 046: Add minimal customs-focused product fields
-- For Pakistan import clearance readiness

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS country_of_origin VARCHAR(120),
  ADD COLUMN IF NOT EXISTS net_weight_kg DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS gross_weight_kg DECIMAL(12,4);

