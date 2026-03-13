-- Migration 008: Customer transactions (sub-ledger for customer balance)
CREATE TABLE IF NOT EXISTS customer_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    transaction_number VARCHAR(50) UNIQUE,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'invoice', 'payment', 'refund', 'credit_note', 'debit_note',
        'adjustment', 'write_off', 'reversal', 'opening_balance'
    )),
    transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP,
    reference_type VARCHAR(50),
    reference_id UUID,
    reference_number VARCHAR(100),
    gross_amount DECIMAL(15, 2) DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    net_amount DECIMAL(15, 2) NOT NULL,
    affects_pending_balance BOOLEAN DEFAULT FALSE,
    affects_advance_balance BOOLEAN DEFAULT FALSE,
    balance_impact DECIMAL(15, 2) NOT NULL,
    balance_before JSONB,
    balance_after JSONB,
    line_items JSONB,
    payment_details JSONB,
    status VARCHAR(30) DEFAULT 'posted' CHECK (status IN (
        'draft', 'posted', 'paid', 'partially_paid', 'overdue', 'cancelled', 'reversed', 'written_off'
    )),
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    remaining_amount DECIMAL(15, 2) DEFAULT 0,
    age_in_days INTEGER DEFAULT 0,
    aging_bucket VARCHAR(20) DEFAULT 'current',
    is_overdue BOOLEAN DEFAULT FALSE,
    days_overdue INTEGER DEFAULT 0,
    created_by UUID NOT NULL,
    posted_by UUID,
    posted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_transactions_customer ON customer_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_type ON customer_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_date ON customer_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_reference ON customer_transactions(reference_id, reference_type);
