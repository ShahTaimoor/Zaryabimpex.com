-- Till movements audit trail + session enhancements

ALTER TABLE till_sessions
  ADD COLUMN IF NOT EXISTS opened_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id);

CREATE TABLE IF NOT EXISTS till_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    till_session_id UUID NOT NULL REFERENCES till_sessions(id),
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN (
        'cash_sale',
        'customer_payment',
        'cash_receipt',
        'expense',
        'cash_withdrawal',
        'supplier_payment',
        'refund',
        'opening',
        'adjustment'
    )),
    direction VARCHAR(3) NOT NULL CHECK (direction IN ('in', 'out')),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    reference_type VARCHAR(50),
    reference_id VARCHAR(100),
    reference_number VARCHAR(100),
    description TEXT DEFAULT '',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_till_movements_session ON till_movements(till_session_id);
CREATE INDEX IF NOT EXISTS idx_till_movements_created_at ON till_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_till_movements_type ON till_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_till_movements_reference ON till_movements(reference_type, reference_id);

-- Prevent duplicate movement records for the same source document
CREATE UNIQUE INDEX IF NOT EXISTS idx_till_movements_dedup
  ON till_movements(till_session_id, movement_type, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- One open till session per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_till_sessions_one_open_per_user
  ON till_sessions(user_id)
  WHERE status = 'open';
