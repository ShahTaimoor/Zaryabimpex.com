-- Migration 039: Add dual unit support (pieces per box) to products
-- When pieces_per_box > 1, product supports both boxes and pieces
-- Stock is always managed in pieces (base unit)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pieces_per_box DECIMAL(10, 2) DEFAULT NULL;

COMMENT ON COLUMN products.pieces_per_box IS 'Conversion: 1 box = pieces_per_box pieces. Null or 1 = pieces-only mode.';
