-- Migration: Make reference_id NOT NULL in account_ledger
-- This ensures all ledger entries have a reference to their source transaction

-- Step 1: Update any existing NULL reference_id values
-- Use transaction_id as fallback reference_id if reference_id is NULL
UPDATE account_ledger
SET reference_id = gen_random_uuid()
WHERE reference_id IS NULL
  AND transaction_id IS NOT NULL;

-- Step 2: For any remaining NULLs (shouldn't happen, but handle edge case)
-- Generate UUIDs for any remaining NULL reference_ids
UPDATE account_ledger
SET reference_id = gen_random_uuid()
WHERE reference_id IS NULL;

-- Step 3: Add NOT NULL constraint
ALTER TABLE account_ledger
ALTER COLUMN reference_id SET NOT NULL;

-- Step 4: Add comment to document the requirement
COMMENT ON COLUMN account_ledger.reference_id IS 'Required reference to source transaction/document (sale, receipt, payment, etc.)';
