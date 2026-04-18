-- Optional smaller index for payment_status filters (run after 050; requires free disk space).
CREATE INDEX IF NOT EXISTS idx_purchases_payment_status_active
  ON purchases (payment_status)
  WHERE deleted_at IS NULL;
