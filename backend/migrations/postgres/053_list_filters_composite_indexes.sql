-- Composite / expression indexes aligned with common list + report filters:
-- date/status/customer/supplier/product paths and stable keyset ordering (created_at, id).

-- Sales: status + sale_date and payment_status + sale_date (partial: active rows only)
CREATE INDEX IF NOT EXISTS idx_sales_status_sale_date_active
  ON sales (status, sale_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_payment_status_sale_date_active
  ON sales (payment_status, sale_date DESC)
  WHERE deleted_at IS NULL;

-- Sales: keyset-friendly tie-break on id for created_at DESC pagination
CREATE INDEX IF NOT EXISTS idx_sales_created_at_id_active
  ON sales (created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- Purchase invoices: supplier + time, status + time; expression matches COALESCE(invoice_date, created_at) filters
CREATE INDEX IF NOT EXISTS idx_pi_supplier_created_active
  ON purchase_invoices (supplier_id, created_at DESC)
  WHERE deleted_at IS NULL AND supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pi_status_created_active
  ON purchase_invoices (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pi_effective_date_active
  ON purchase_invoices ((COALESCE(invoice_date, created_at)) DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pi_created_at_id_active
  ON purchase_invoices (created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- Stock movements: product + time; status + time; keyset
CREATE INDEX IF NOT EXISTS idx_sm_product_created_at
  ON stock_movements (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sm_status_created_at
  ON stock_movements (status, created_at DESC)
  WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sm_created_at_id
  ON stock_movements (created_at DESC, id DESC);

-- Products: list ordering + keyset (active catalog rows)
CREATE INDEX IF NOT EXISTS idx_products_created_at_id_active
  ON products (created_at DESC, id DESC)
  WHERE (is_deleted = FALSE OR is_deleted IS NULL);
