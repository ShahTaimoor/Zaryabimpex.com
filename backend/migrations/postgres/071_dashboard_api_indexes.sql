-- Dashboard / recurring expense hot paths (range filters + active upcoming list)

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active_next_due
  ON recurring_expenses (next_due_date ASC)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_coalesce_date_active
  ON purchase_invoices ((COALESCE(invoice_date, created_at)) DESC)
  WHERE deleted_at IS NULL;
