-- Journal Voucher System
-- Allows recording non-cash and adjustment transactions using double-entry accounting

CREATE TABLE IF NOT EXISTS journal_vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_number VARCHAR(50) UNIQUE NOT NULL,
    voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    total_debit DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    total_credit DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed', 'cancelled')),
    is_reversed BOOLEAN DEFAULT FALSE,
    reversed_date TIMESTAMP,
    reversed_by UUID,
    reversal_of_jv_id UUID REFERENCES journal_vouchers(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Journal Voucher Line Items
-- Each entry represents a debit or credit in the voucher
CREATE TABLE IF NOT EXISTS journal_voucher_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_voucher_id UUID NOT NULL REFERENCES journal_vouchers(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    account_code VARCHAR(20) NOT NULL REFERENCES chart_of_accounts(account_code) ON DELETE RESTRICT,
    account_name VARCHAR(255),
    particulars TEXT,
    debit_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (debit_amount >= 0),
    credit_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (credit_amount >= 0),
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_entry_has_one_side CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR 
        (debit_amount = 0 AND credit_amount > 0)
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_journal_vouchers_date
  ON journal_vouchers(voucher_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_vouchers_status
  ON journal_vouchers(status);

CREATE INDEX IF NOT EXISTS idx_journal_vouchers_created_by
  ON journal_vouchers(created_by);

CREATE INDEX IF NOT EXISTS idx_journal_vouchers_voucher_number
  ON journal_vouchers(voucher_number);

CREATE INDEX IF NOT EXISTS idx_journal_voucher_entries_voucher_id
  ON journal_voucher_entries(journal_voucher_id);

CREATE INDEX IF NOT EXISTS idx_journal_voucher_entries_account
  ON journal_voucher_entries(account_code);

-- Audit trail for JV changes (optional - tracks all edits)
CREATE TABLE IF NOT EXISTS journal_voucher_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_voucher_id UUID NOT NULL REFERENCES journal_vouchers(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'updated', 'posted', 'reversed', 'deleted')),
    changed_by UUID NOT NULL,
    change_details JSONB,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_journal_voucher_audit_log_jv_id
  ON journal_voucher_audit_log(journal_voucher_id);

CREATE INDEX IF NOT EXISTS idx_journal_voucher_audit_log_changed_at
  ON journal_voucher_audit_log(changed_at DESC);
