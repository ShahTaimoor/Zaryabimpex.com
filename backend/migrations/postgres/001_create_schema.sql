-- PostgreSQL Schema for SA-POS Accounting System
-- This migration creates all tables for Chart of Accounts, Ledger, Transactions, etc.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CHART OF ACCOUNTS
-- ============================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_code VARCHAR(50) UNIQUE NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    account_category VARCHAR(100) NOT NULL,
    parent_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
    level INTEGER DEFAULT 0 CHECK (level >= 0 AND level <= 5),
    is_active BOOLEAN DEFAULT TRUE,
    is_system_account BOOLEAN DEFAULT FALSE,
    allow_direct_posting BOOLEAN DEFAULT TRUE,
    normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    current_balance DECIMAL(15, 2) DEFAULT 0,
    opening_balance DECIMAL(15, 2) DEFAULT 0,
    description TEXT,
    currency VARCHAR(3) DEFAULT 'PKR',
    is_taxable BOOLEAN DEFAULT FALSE,
    tax_rate DECIMAL(5, 2) DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
    requires_reconciliation BOOLEAN DEFAULT FALSE,
    last_reconciliation_date TIMESTAMP,
    reconciliation_status VARCHAR(50) DEFAULT 'not_started' CHECK (reconciliation_status IN ('not_started', 'in_progress', 'reconciled', 'discrepancy')),
    reconciled_by UUID,
    reconciled_at TIMESTAMP,
    notes TEXT,
    tags TEXT[],
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for Chart of Accounts
CREATE INDEX IF NOT EXISTS idx_coa_account_code ON chart_of_accounts(account_code);
CREATE INDEX IF NOT EXISTS idx_coa_account_type ON chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_coa_parent_account ON chart_of_accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_coa_is_active ON chart_of_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_coa_deleted_at ON chart_of_accounts(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- ACCOUNT LEDGER (TRANSACTIONS)
-- ============================================
CREATE TABLE IF NOT EXISTS account_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    account_code VARCHAR(50) NOT NULL REFERENCES chart_of_accounts(account_code),
    debit_amount DECIMAL(15, 2) DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount DECIMAL(15, 2) DEFAULT 0 CHECK (credit_amount >= 0),
    CHECK (debit_amount = 0 OR credit_amount = 0), -- Only one can be non-zero
    description TEXT NOT NULL,
    reference_type VARCHAR(50), -- 'invoice', 'receipt', 'payment', 'journal', etc.
    reference_id UUID,
    reference_number VARCHAR(100),
    customer_id UUID,
    supplier_id UUID,
    product_id UUID,
    currency VARCHAR(3) DEFAULT 'PKR',
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'reversed')),
    payment_method VARCHAR(50),
    order_id UUID,
    payment_id UUID,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reversed_at TIMESTAMP,
    reversed_by UUID,
    reversal_reason TEXT
);

-- Indexes for Account Ledger
CREATE INDEX IF NOT EXISTS idx_ledger_transaction_id ON account_ledger(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account_code ON account_ledger(account_code);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction_date ON account_ledger(transaction_date);
CREATE INDEX IF NOT EXISTS idx_ledger_customer ON account_ledger(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_supplier ON account_ledger(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_status ON account_ledger(status);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON account_ledger(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_currency ON account_ledger(currency);

-- ============================================
-- CUSTOMERS
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    business_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address JSONB,
    opening_balance DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    pending_balance DECIMAL(15, 2) DEFAULT 0,
    advance_balance DECIMAL(15, 2) DEFAULT 0,
    credit_limit DECIMAL(15, 2) DEFAULT 0,
    ledger_account_id UUID REFERENCES chart_of_accounts(id),
    payment_terms VARCHAR(100),
    tax_id VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for Customers
CREATE INDEX IF NOT EXISTS idx_customers_business_name ON customers(business_name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_is_deleted ON customers(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_customers_ledger_account ON customers(ledger_account_id);

-- ============================================
-- SUPPLIERS
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    company_name VARCHAR(255),
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address JSONB,
    opening_balance DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    pending_balance DECIMAL(15, 2) DEFAULT 0,
    advance_balance DECIMAL(15, 2) DEFAULT 0,
    credit_limit DECIMAL(15, 2) DEFAULT 0,
    ledger_account_id UUID REFERENCES chart_of_accounts(id),
    payment_terms VARCHAR(100),
    tax_id VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for Suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_company_name ON suppliers(company_name);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_deleted ON suppliers(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_suppliers_ledger_account ON suppliers(ledger_account_id);

-- ============================================
-- PRODUCTS
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(100),
    description TEXT,
    category_id UUID,
    cost_price DECIMAL(15, 2) DEFAULT 0,
    selling_price DECIMAL(15, 2) DEFAULT 0,
    inventory_account_id UUID REFERENCES chart_of_accounts(id),
    cogs_account_id UUID REFERENCES chart_of_accounts(id),
    stock_quantity DECIMAL(10, 2) DEFAULT 0,
    min_stock_level DECIMAL(10, 2) DEFAULT 0,
    unit VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for Products
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON products(is_deleted) WHERE is_deleted = FALSE;

-- ============================================
-- SALES
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    items JSONB NOT NULL, -- Array of items with product_id, quantity, price, etc.
    subtotal DECIMAL(15, 2) DEFAULT 0,
    discount DECIMAL(15, 2) DEFAULT 0,
    tax DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) DEFAULT 0,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    notes TEXT,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for Sales
CREATE INDEX IF NOT EXISTS idx_sales_order_number ON sales(order_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);

-- ============================================
-- PURCHASES
-- ============================================
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    items JSONB NOT NULL,
    subtotal DECIMAL(15, 2) DEFAULT 0,
    discount DECIMAL(15, 2) DEFAULT 0,
    tax DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) DEFAULT 0,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'received', 'completed', 'cancelled')),
    notes TEXT,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for Purchases
CREATE INDEX IF NOT EXISTS idx_purchases_order_number ON purchases(purchase_order_number);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);

-- ============================================
-- RETURNS
-- ============================================
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_number VARCHAR(100) UNIQUE NOT NULL,
    return_type VARCHAR(50) NOT NULL CHECK (return_type IN ('sale_return', 'purchase_return')),
    reference_id UUID NOT NULL, -- sales_id or purchases_id
    customer_id UUID REFERENCES customers(id),
    supplier_id UUID REFERENCES suppliers(id),
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    items JSONB NOT NULL,
    total_amount DECIMAL(15, 2) DEFAULT 0,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for Returns
CREATE INDEX IF NOT EXISTS idx_returns_return_number ON returns(return_number);
CREATE INDEX IF NOT EXISTS idx_returns_type ON returns(return_type);
CREATE INDEX IF NOT EXISTS idx_returns_customer ON returns(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_returns_supplier ON returns(supplier_id) WHERE supplier_id IS NOT NULL;

-- ============================================
-- CASH RECEIPTS
-- ============================================
CREATE TABLE IF NOT EXISTS cash_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    customer_id UUID REFERENCES customers(id),
    particular TEXT,
    payment_method VARCHAR(50) DEFAULT 'cash',
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for Cash Receipts
CREATE INDEX IF NOT EXISTS idx_cash_receipts_number ON cash_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_date ON cash_receipts(date);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_customer ON cash_receipts(customer_id) WHERE customer_id IS NOT NULL;

-- ============================================
-- BANK RECEIPTS
-- ============================================
CREATE TABLE IF NOT EXISTS bank_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    bank_id UUID,
    customer_id UUID REFERENCES customers(id),
    particular TEXT,
    transaction_reference VARCHAR(100),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for Bank Receipts
CREATE INDEX IF NOT EXISTS idx_bank_receipts_number ON bank_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_bank_receipts_date ON bank_receipts(date);
CREATE INDEX IF NOT EXISTS idx_bank_receipts_customer ON bank_receipts(customer_id) WHERE customer_id IS NOT NULL;

-- ============================================
-- CASH PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS cash_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_number VARCHAR(100) UNIQUE NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    supplier_id UUID REFERENCES suppliers(id),
    customer_id UUID REFERENCES customers(id),
    particular TEXT,
    payment_method VARCHAR(50) DEFAULT 'cash',
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for Cash Payments
CREATE INDEX IF NOT EXISTS idx_cash_payments_number ON cash_payments(payment_number);
CREATE INDEX IF NOT EXISTS idx_cash_payments_date ON cash_payments(date);
CREATE INDEX IF NOT EXISTS idx_cash_payments_supplier ON cash_payments(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_payments_customer ON cash_payments(customer_id) WHERE customer_id IS NOT NULL;

-- ============================================
-- BANK PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS bank_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_number VARCHAR(100) UNIQUE NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    bank_id UUID,
    supplier_id UUID REFERENCES suppliers(id),
    customer_id UUID REFERENCES customers(id),
    particular TEXT,
    transaction_reference VARCHAR(100),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for Bank Payments
CREATE INDEX IF NOT EXISTS idx_bank_payments_number ON bank_payments(payment_number);
CREATE INDEX IF NOT EXISTS idx_bank_payments_date ON bank_payments(date);
CREATE INDEX IF NOT EXISTS idx_bank_payments_supplier ON bank_payments(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_payments_customer ON bank_payments(customer_id) WHERE customer_id IS NOT NULL;

-- ============================================
-- JOURNAL VOUCHERS
-- ============================================
CREATE TABLE IF NOT EXISTS journal_vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_number VARCHAR(100) UNIQUE NOT NULL,
    voucher_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    entries JSONB NOT NULL, -- Array of {account_code, debit, credit, description}
    total_debit DECIMAL(15, 2) NOT NULL,
    total_credit DECIMAL(15, 2) NOT NULL,
    CHECK (total_debit = total_credit), -- Double-entry validation
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
    posted_at TIMESTAMP,
    posted_by UUID,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for Journal Vouchers
CREATE INDEX IF NOT EXISTS idx_journal_vouchers_number ON journal_vouchers(voucher_number);
CREATE INDEX IF NOT EXISTS idx_journal_vouchers_date ON journal_vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_journal_vouchers_status ON journal_vouchers(status);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_chart_of_accounts_updated_at BEFORE UPDATE ON chart_of_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_ledger_updated_at BEFORE UPDATE ON account_ledger
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_returns_updated_at BEFORE UPDATE ON returns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cash_receipts_updated_at BEFORE UPDATE ON cash_receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_receipts_updated_at BEFORE UPDATE ON bank_receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cash_payments_updated_at BEFORE UPDATE ON cash_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_payments_updated_at BEFORE UPDATE ON bank_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_vouchers_updated_at BEFORE UPDATE ON journal_vouchers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR BALANCE CALCULATIONS
-- ============================================

-- View for account balances (calculated from ledger)
CREATE OR REPLACE VIEW account_balances AS
SELECT 
    coa.id,
    coa.account_code,
    coa.account_name,
    coa.account_type,
    coa.normal_balance,
    coa.opening_balance,
    COALESCE(SUM(
        CASE 
            WHEN coa.normal_balance = 'debit' THEN (ledger.debit_amount - ledger.credit_amount)
            ELSE (ledger.credit_amount - ledger.debit_amount)
        END
    ), 0) AS ledger_balance,
    (coa.opening_balance + COALESCE(SUM(
        CASE 
            WHEN coa.normal_balance = 'debit' THEN (ledger.debit_amount - ledger.credit_amount)
            ELSE (ledger.credit_amount - ledger.debit_amount)
        END
    ), 0)) AS current_balance
FROM chart_of_accounts coa
LEFT JOIN account_ledger ledger ON coa.account_code = ledger.account_code 
    AND ledger.status = 'completed' 
    AND ledger.reversed_at IS NULL
GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type, coa.normal_balance, coa.opening_balance;

-- View for customer balances
CREATE OR REPLACE VIEW customer_balances AS
SELECT 
    c.id,
    c.business_name,
    c.opening_balance,
    COALESCE(SUM(
        CASE 
            WHEN ledger.debit_amount > 0 THEN ledger.debit_amount
            ELSE -ledger.credit_amount
        END
    ), 0) AS ledger_balance,
    (c.opening_balance + COALESCE(SUM(
        CASE 
            WHEN ledger.debit_amount > 0 THEN ledger.debit_amount
            ELSE -ledger.credit_amount
        END
    ), 0)) AS current_balance
FROM customers c
LEFT JOIN account_ledger ledger ON c.id = ledger.customer_id 
    AND ledger.status = 'completed' 
    AND ledger.reversed_at IS NULL
GROUP BY c.id, c.business_name, c.opening_balance;

-- View for supplier balances
CREATE OR REPLACE VIEW supplier_balances AS
SELECT 
    s.id,
    s.company_name,
    s.opening_balance,
    COALESCE(SUM(
        CASE 
            WHEN ledger.credit_amount > 0 THEN ledger.credit_amount
            ELSE -ledger.debit_amount
        END
    ), 0) AS ledger_balance,
    (s.opening_balance + COALESCE(SUM(
        CASE 
            WHEN ledger.credit_amount > 0 THEN ledger.credit_amount
            ELSE -ledger.debit_amount
        END
    ), 0)) AS current_balance
FROM suppliers s
LEFT JOIN account_ledger ledger ON s.id = ledger.supplier_id 
    AND ledger.status = 'completed' 
    AND ledger.reversed_at IS NULL
GROUP BY s.id, s.company_name, s.opening_balance;
