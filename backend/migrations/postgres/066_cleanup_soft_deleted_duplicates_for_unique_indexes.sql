-- Cleanup helper migration for normalized unique indexes introduced in 065.
-- Strategy:
-- 1) Keep all active (is_deleted = FALSE) rows untouched.
-- 2) For soft-deleted rows, remove duplicate normalized values while keeping the most recent row.
-- 3) Emit NOTICE summaries for visibility during migration logs.

-- =========================================================
-- Customers: soft-deleted duplicate emails
-- =========================================================
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(email))
      ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
    ) AS rn
  FROM customers
  WHERE is_deleted = TRUE
    AND email IS NOT NULL
    AND TRIM(email) <> ''
)
DELETE FROM customers c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;

-- =========================================================
-- Customers: soft-deleted duplicate business names
-- =========================================================
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(business_name))
      ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
    ) AS rn
  FROM customers
  WHERE is_deleted = TRUE
    AND business_name IS NOT NULL
    AND TRIM(business_name) <> ''
)
DELETE FROM customers c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;

-- =========================================================
-- Suppliers: soft-deleted duplicate emails
-- =========================================================
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(email))
      ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
    ) AS rn
  FROM suppliers
  WHERE is_deleted = TRUE
    AND email IS NOT NULL
    AND TRIM(email) <> ''
)
DELETE FROM suppliers s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- =========================================================
-- Suppliers: soft-deleted duplicate company names
-- =========================================================
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(company_name))
      ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
    ) AS rn
  FROM suppliers
  WHERE is_deleted = TRUE
    AND company_name IS NOT NULL
    AND TRIM(company_name) <> ''
)
DELETE FROM suppliers s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- =========================================================
-- Notice summary (active duplicates still need manual merge/fix)
-- =========================================================
DO $$
DECLARE
  c_email_dups bigint;
  c_name_dups bigint;
  s_email_dups bigint;
  s_name_dups bigint;
BEGIN
  SELECT COUNT(*) INTO c_email_dups
  FROM (
    SELECT LOWER(TRIM(email))
    FROM customers
    WHERE is_deleted = FALSE AND email IS NOT NULL AND TRIM(email) <> ''
    GROUP BY LOWER(TRIM(email))
    HAVING COUNT(*) > 1
  ) t;

  SELECT COUNT(*) INTO c_name_dups
  FROM (
    SELECT LOWER(TRIM(business_name))
    FROM customers
    WHERE is_deleted = FALSE AND business_name IS NOT NULL AND TRIM(business_name) <> ''
    GROUP BY LOWER(TRIM(business_name))
    HAVING COUNT(*) > 1
  ) t;

  SELECT COUNT(*) INTO s_email_dups
  FROM (
    SELECT LOWER(TRIM(email))
    FROM suppliers
    WHERE is_deleted = FALSE AND email IS NOT NULL AND TRIM(email) <> ''
    GROUP BY LOWER(TRIM(email))
    HAVING COUNT(*) > 1
  ) t;

  SELECT COUNT(*) INTO s_name_dups
  FROM (
    SELECT LOWER(TRIM(company_name))
    FROM suppliers
    WHERE is_deleted = FALSE AND company_name IS NOT NULL AND TRIM(company_name) <> ''
    GROUP BY LOWER(TRIM(company_name))
    HAVING COUNT(*) > 1
  ) t;

  RAISE NOTICE 'Active duplicate groups remaining => customers.email: %, customers.business_name: %, suppliers.email: %, suppliers.company_name: %',
    c_email_dups, c_name_dups, s_email_dups, s_name_dups;
END $$;
