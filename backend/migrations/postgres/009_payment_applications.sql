-- Migration 009: Payment applications (payment-to-invoice allocation)
CREATE TABLE IF NOT EXISTS payment_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES customer_transactions(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    applications JSONB NOT NULL DEFAULT '[]',
    unapplied_amount DECIMAL(15, 2) DEFAULT 0,
    total_payment_amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'applied', 'reversed')),
    is_reversed BOOLEAN DEFAULT FALSE,
    reversed_by_id UUID REFERENCES payment_applications(id),
    reversed_at TIMESTAMP,
    created_by UUID NOT NULL,
    applied_by UUID,
    notes VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_applications_customer ON payment_applications(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_applications_payment ON payment_applications(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_applications_status ON payment_applications(status);
