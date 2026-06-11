-- Daily Cash Closing: replace open/close till sessions with per-day reconciliation

CREATE TABLE IF NOT EXISTS daily_cash_closings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_date DATE NOT NULL,
    opening_cash DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
    cash_in DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (cash_in >= 0),
    cash_out DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (cash_out >= 0),
    expected_cash DECIMAL(15, 2) NOT NULL DEFAULT 0,
    actual_cash DECIMAL(15, 2) CHECK (actual_cash IS NULL OR actual_cash >= 0),
    difference DECIMAL(15, 2),
    variance_type VARCHAR(10) CHECK (variance_type IS NULL OR variance_type IN ('over', 'short', 'exact')),
    notes TEXT DEFAULT '',
    closed_by UUID REFERENCES users(id),
    closed_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_cash_closings_date
  ON daily_cash_closings(business_date);

CREATE INDEX IF NOT EXISTS idx_daily_cash_closings_status
  ON daily_cash_closings(status);

CREATE INDEX IF NOT EXISTS idx_daily_cash_closings_closed_at
  ON daily_cash_closings(closed_at DESC);

-- Extend till_movements for date-based cash tracking (immutable audit trail)
ALTER TABLE till_movements
  ADD COLUMN IF NOT EXISTS business_date DATE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

UPDATE till_movements
SET business_date = (created_at AT TIME ZONE 'Asia/Karachi')::date
WHERE business_date IS NULL;

ALTER TABLE till_movements
  ALTER COLUMN business_date SET NOT NULL;

ALTER TABLE till_movements
  ALTER COLUMN till_session_id DROP NOT NULL;

-- Replace session-scoped dedup with business-date scoped dedup
DROP INDEX IF EXISTS idx_till_movements_dedup;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_movements_dedup
  ON till_movements(business_date, movement_type, reference_type, reference_id)
  WHERE reference_id IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_till_movements_business_date
  ON till_movements(business_date);

CREATE INDEX IF NOT EXISTS idx_till_movements_business_date_status
  ON till_movements(business_date, status);

CREATE INDEX IF NOT EXISTS idx_till_movements_created_by
  ON till_movements(created_by);
