-- Purchase order list: filter by supplier + date (partial: active rows only).
-- Kept to a SINGLE index to reduce disk use during CREATE INDEX (see 051 for payment_status).
-- If you see "No space left on device": free disk on the PostgreSQL data drive, then re-run migrate (IF NOT EXISTS is idempotent).
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_purchase_date
  ON purchases (supplier_id, purchase_date DESC)
  WHERE deleted_at IS NULL;
