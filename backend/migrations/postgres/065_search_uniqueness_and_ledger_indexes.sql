-- Targeted performance + integrity migration:
-- 1) Speed up ILIKE '%term%' lookups with pg_trgm on hot search fields
-- 2) Enforce normalized uniqueness (email/business names) when data is clean
-- 3) Add partial composite indexes for common ledger reporting filters

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =========================================================
-- Search indexes (ILIKE on customer/supplier list endpoints)
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_customers_business_name_trgm
  ON customers USING gin (business_name gin_trgm_ops)
  WHERE is_deleted = FALSE AND business_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON customers USING gin (name gin_trgm_ops)
  WHERE is_deleted = FALSE AND name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
  ON customers USING gin (email gin_trgm_ops)
  WHERE is_deleted = FALSE AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm
  ON customers USING gin (phone gin_trgm_ops)
  WHERE is_deleted = FALSE AND phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_company_name_trgm
  ON suppliers USING gin (company_name gin_trgm_ops)
  WHERE is_deleted = FALSE AND company_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm
  ON suppliers USING gin (name gin_trgm_ops)
  WHERE is_deleted = FALSE AND name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_email_trgm
  ON suppliers USING gin (email gin_trgm_ops)
  WHERE is_deleted = FALSE AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_contact_person_trgm
  ON suppliers USING gin (contact_person gin_trgm_ops)
  WHERE is_deleted = FALSE AND contact_person IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_phone_trgm
  ON suppliers USING gin (phone gin_trgm_ops)
  WHERE is_deleted = FALSE AND phone IS NOT NULL;

-- =========================================================
-- Normalized unique indexes (created only if no duplicates)
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM (
      SELECT LOWER(TRIM(email)) AS normalized_email
      FROM customers
      WHERE is_deleted = FALSE AND email IS NOT NULL AND TRIM(email) <> ''
      GROUP BY LOWER(TRIM(email))
      HAVING COUNT(*) > 1
    ) dup
  ) THEN
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_email_normalized_active
      ON customers (LOWER(TRIM(email)))
      WHERE is_deleted = FALSE AND email IS NOT NULL AND TRIM(email) <> ''''
    ';
  ELSE
    RAISE NOTICE 'Skipping uq_customers_email_normalized_active: duplicate normalized emails exist.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM (
      SELECT LOWER(TRIM(business_name)) AS normalized_business_name
      FROM customers
      WHERE is_deleted = FALSE AND business_name IS NOT NULL AND TRIM(business_name) <> ''
      GROUP BY LOWER(TRIM(business_name))
      HAVING COUNT(*) > 1
    ) dup
  ) THEN
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_business_name_normalized_active
      ON customers (LOWER(TRIM(business_name)))
      WHERE is_deleted = FALSE AND business_name IS NOT NULL AND TRIM(business_name) <> ''''
    ';
  ELSE
    RAISE NOTICE 'Skipping uq_customers_business_name_normalized_active: duplicate normalized names exist.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM (
      SELECT LOWER(TRIM(email)) AS normalized_email
      FROM suppliers
      WHERE is_deleted = FALSE AND email IS NOT NULL AND TRIM(email) <> ''
      GROUP BY LOWER(TRIM(email))
      HAVING COUNT(*) > 1
    ) dup
  ) THEN
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_email_normalized_active
      ON suppliers (LOWER(TRIM(email)))
      WHERE is_deleted = FALSE AND email IS NOT NULL AND TRIM(email) <> ''''
    ';
  ELSE
    RAISE NOTICE 'Skipping uq_suppliers_email_normalized_active: duplicate normalized emails exist.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM (
      SELECT LOWER(TRIM(company_name)) AS normalized_company_name
      FROM suppliers
      WHERE is_deleted = FALSE AND company_name IS NOT NULL AND TRIM(company_name) <> ''
      GROUP BY LOWER(TRIM(company_name))
      HAVING COUNT(*) > 1
    ) dup
  ) THEN
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_company_name_normalized_active
      ON suppliers (LOWER(TRIM(company_name)))
      WHERE is_deleted = FALSE AND company_name IS NOT NULL AND TRIM(company_name) <> ''''
    ';
  ELSE
    RAISE NOTICE 'Skipping uq_suppliers_company_name_normalized_active: duplicate normalized names exist.';
  END IF;
END $$;

-- =========================================================
-- Ledger/reporting indexes
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_ledger_account_code_txn_date_completed_active
  ON account_ledger (account_code, transaction_date DESC)
  WHERE status = 'completed' AND reversed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_customer_txn_date_completed_active
  ON account_ledger (customer_id, transaction_date DESC)
  WHERE status = 'completed' AND reversed_at IS NULL AND customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_supplier_txn_date_completed_active
  ON account_ledger (supplier_id, transaction_date DESC)
  WHERE status = 'completed' AND reversed_at IS NULL AND supplier_id IS NOT NULL;
