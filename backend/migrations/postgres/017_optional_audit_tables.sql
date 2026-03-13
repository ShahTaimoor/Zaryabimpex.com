-- Optional §6 tables: JournalVoucher, AccountingPeriod, FinancialStatementExport, Budget, UserBehavior

-- ============================================
-- JOURNAL VOUCHERS (pending approvals dashboard)
-- ============================================
CREATE TABLE IF NOT EXISTS journal_vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_number VARCHAR(50) UNIQUE,
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'rejected')),
    total_debit DECIMAL(15, 2) DEFAULT 0,
    total_credit DECIMAL(15, 2) DEFAULT 0,
    approval_workflow JSONB DEFAULT '{}',
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_journal_vouchers_status ON journal_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_journal_vouchers_created_at ON journal_vouchers(created_at DESC);

-- ============================================
-- ACCOUNTING PERIODS (period close / trial balance)
-- ============================================
CREATE TABLE IF NOT EXISTS accounting_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed')),
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_dates ON accounting_periods(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_status ON accounting_periods(status);

-- ============================================
-- FINANCIAL STATEMENT EXPORTS (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS financial_statement_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement_id UUID,
    statement_type VARCHAR(30) NOT NULL CHECK (statement_type IN ('profit_loss', 'balance_sheet', 'cash_flow')),
    exported_by UUID NOT NULL,
    exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    format VARCHAR(20) NOT NULL CHECK (format IN ('pdf', 'excel', 'csv', 'json')),
    file_size BIGINT,
    file_hash VARCHAR(64),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_statement_exports_exported_at ON financial_statement_exports(exported_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_statement_exports_exported_by ON financial_statement_exports(exported_by);

-- ============================================
-- BUDGETS (budget vs actual)
-- ============================================
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_id VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type VARCHAR(20) DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'quarterly', 'yearly', 'custom')),
    budget_type VARCHAR(20) DEFAULT 'expense' CHECK (budget_type IN ('expense', 'revenue', 'full')),
    items JSONB DEFAULT '[]',
    totals_selling_expenses DECIMAL(15, 2) DEFAULT 0,
    totals_administrative_expenses DECIMAL(15, 2) DEFAULT 0,
    totals_total_expenses DECIMAL(15, 2) DEFAULT 0,
    totals_total_revenue DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active', 'archived')),
    approved_by UUID,
    approved_at TIMESTAMP,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_budgets_status_type ON budgets(status, budget_type);

-- ============================================
-- USER BEHAVIORS (recommendation engine)
-- ============================================
CREATE TABLE IF NOT EXISTS user_behaviors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    customer_id UUID,
    session_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'page_view', 'product_view', 'product_click', 'add_to_cart', 'remove_from_cart',
        'purchase', 'search', 'filter', 'category_view', 'recommendation_view', 'recommendation_click', 'recommendation_dismiss'
    )),
    entity_type VARCHAR(30),
    entity_id UUID,
    entity_name VARCHAR(255),
    category_id UUID,
    context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_behaviors_session ON user_behaviors(session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_user ON user_behaviors(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_action ON user_behaviors(action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_entity ON user_behaviors(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_timestamp ON user_behaviors(timestamp DESC);
