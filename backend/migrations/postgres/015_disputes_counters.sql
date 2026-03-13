-- Disputes table for disputeManagementService
CREATE TABLE IF NOT EXISTS disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    dispute_number VARCHAR(50) UNIQUE,
    dispute_type VARCHAR(50) NOT NULL CHECK (dispute_type IN ('chargeback', 'refund_request', 'billing_error', 'duplicate_charge', 'unauthorized', 'other')),
    status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'rejected', 'escalated')),
    disputed_amount DECIMAL(15, 2) NOT NULL CHECK (disputed_amount >= 0),
    reason TEXT NOT NULL,
    customer_description TEXT,
    internal_notes TEXT,
    resolution VARCHAR(30) CHECK (resolution IN ('refund_full', 'refund_partial', 'credit_note', 'adjustment', 'rejected', 'other')),
    resolution_amount DECIMAL(15, 2) CHECK (resolution_amount >= 0),
    resolution_notes TEXT,
    resolved_by UUID,
    resolved_at TIMESTAMP,
    communications JSONB DEFAULT '[]',
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date TIMESTAMP,
    created_by UUID NOT NULL,
    assigned_to UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disputes_customer ON disputes(customer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_transaction ON disputes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_due_date ON disputes(due_date);

-- Counters for dispute numbers (and other sequences)
CREATE TABLE IF NOT EXISTS counters (
    name VARCHAR(100) PRIMARY KEY,
    seq INTEGER NOT NULL DEFAULT 0
);

INSERT INTO counters (name, seq) VALUES ('dispute', 0) ON CONFLICT (name) DO NOTHING;
