-- Migration 006: Add tables for repositories previously MongoDB-only
-- Covers: account_categories, attendance, backups, banks, cities, discounts,
-- drop_shipping, employees, inventory_reports, inventory, investors, notes,
-- payments, product_transformations, product_variants, profit_shares,
-- purchase_invoices, purchase_orders, recommendations, recurring_expenses,
-- sales_orders, sales_performance, settings, stock_adjustments, stock_movements,
-- till_sessions, warehouses

-- ============================================
-- ACCOUNT CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS account_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_system_category BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    color VARCHAR(20) DEFAULT '#6B7280',
    notes TEXT,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_account_categories_account_type ON account_categories(account_type);
CREATE INDEX IF NOT EXISTS idx_account_categories_is_active ON account_categories(is_active);

-- ============================================
-- BANKS
-- ============================================
CREATE TABLE IF NOT EXISTS banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_name VARCHAR(200) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    bank_name VARCHAR(200) NOT NULL,
    branch_name VARCHAR(200),
    branch_address JSONB,
    account_type VARCHAR(50) DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings', 'current', 'other')),
    routing_number VARCHAR(50),
    swift_code VARCHAR(50),
    iban VARCHAR(50),
    opening_balance DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_by UUID NOT NULL,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_banks_bank_name_account ON banks(bank_name, account_number);
CREATE INDEX IF NOT EXISTS idx_banks_is_active ON banks(is_active);
CREATE INDEX IF NOT EXISTS idx_banks_deleted_at ON banks(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- CITIES
-- ============================================
CREATE TABLE IF NOT EXISTS cities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'US',
    is_active BOOLEAN DEFAULT TRUE,
    description VARCHAR(500),
    created_by UUID NOT NULL,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cities_is_active ON cities(is_active);
CREATE INDEX IF NOT EXISTS idx_cities_state ON cities(state);

-- ============================================
-- WAREHOUSES
-- ============================================
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(500),
    address JSONB,
    contact JSONB,
    notes VARCHAR(1000),
    capacity INTEGER,
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_warehouses_name ON warehouses(name);
CREATE INDEX IF NOT EXISTS idx_warehouses_is_active ON warehouses(is_active);
CREATE INDEX IF NOT EXISTS idx_warehouses_is_primary ON warehouses(is_primary);
CREATE INDEX IF NOT EXISTS idx_warehouses_deleted_at ON warehouses(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- EMPLOYEES
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    alternate_phone VARCHAR(50),
    address JSONB,
    position VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    termination_date DATE,
    employment_type VARCHAR(50) DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'temporary', 'intern')),
    salary DECIMAL(15, 2),
    hourly_rate DECIMAL(15, 2),
    pay_frequency VARCHAR(20) DEFAULT 'monthly' CHECK (pay_frequency IN ('weekly', 'biweekly', 'monthly', 'daily')),
    work_schedule VARCHAR(20) DEFAULT 'fixed' CHECK (work_schedule IN ('fixed', 'flexible', 'shift')),
    shift VARCHAR(20) DEFAULT 'morning' CHECK (shift IN ('morning', 'afternoon', 'evening', 'night', 'rotating')),
    emergency_contact JSONB,
    date_of_birth DATE,
    gender VARCHAR(30) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    notes VARCHAR(1000),
    user_account UUID,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated', 'on_leave')),
    documents JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_user_account ON employees(user_account);
CREATE INDEX IF NOT EXISTS idx_employees_deleted_at ON employees(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- ATTENDANCE
-- ============================================
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    user_id UUID,
    store_id VARCHAR(100),
    device_id VARCHAR(100),
    clocked_in_by UUID,
    clock_in_at TIMESTAMP NOT NULL,
    clock_out_at TIMESTAMP,
    total_minutes INTEGER DEFAULT 0,
    breaks JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    notes_in TEXT DEFAULT '',
    notes_out TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_created_at ON attendance(created_at DESC);

-- ============================================
-- TILL SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS till_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    store_id VARCHAR(100),
    device_id VARCHAR(100),
    opened_at TIMESTAMP NOT NULL,
    closed_at TIMESTAMP,
    opening_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    closing_declared_amount DECIMAL(15, 2),
    expected_amount DECIMAL(15, 2),
    variance_amount DECIMAL(15, 2),
    variance_type VARCHAR(10) DEFAULT 'exact' CHECK (variance_type IN ('over', 'short', 'exact')),
    notes_open TEXT DEFAULT '',
    notes_close TEXT DEFAULT '',
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_till_sessions_user ON till_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_till_sessions_status ON till_sessions(status);
CREATE INDEX IF NOT EXISTS idx_till_sessions_created_at ON till_sessions(created_at DESC);

-- ============================================
-- SETTINGS (singleton - company_settings)
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'company_settings',
    company_name VARCHAR(255) NOT NULL DEFAULT 'Zaryab Traders New 2024',
    contact_number VARCHAR(100) NOT NULL DEFAULT '+1 (555) 123-4567',
    address TEXT NOT NULL DEFAULT '123 Business Street, City, State, ZIP',
    email VARCHAR(255),
    website VARCHAR(255),
    tax_id VARCHAR(100),
    registration_number VARCHAR(100),
    currency VARCHAR(10) DEFAULT 'USD',
    date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY' CHECK (date_format IN ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD')),
    time_format VARCHAR(10) DEFAULT '12h' CHECK (time_format IN ('12h', '24h')),
    fiscal_year_start INTEGER DEFAULT 1 CHECK (fiscal_year_start >= 1 AND fiscal_year_start <= 12),
    default_tax_rate DECIMAL(5, 2) DEFAULT 0 CHECK (default_tax_rate >= 0 AND default_tax_rate <= 100),
    print_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DISCOUNTS
-- ============================================
CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    code VARCHAR(20) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
    value DECIMAL(15, 2) NOT NULL CHECK (value >= 0),
    maximum_discount DECIMAL(15, 2),
    minimum_order_amount DECIMAL(15, 2) DEFAULT 0,
    applicable_to VARCHAR(20) DEFAULT 'all' CHECK (applicable_to IN ('all', 'products', 'categories', 'customers')),
    applicable_products UUID[],
    applicable_categories UUID[],
    applicable_customers UUID[],
    customer_tiers TEXT[],
    business_types TEXT[],
    usage_limit INTEGER,
    usage_limit_per_customer INTEGER,
    current_usage INTEGER DEFAULT 0,
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    combinable_with_other_discounts BOOLEAN DEFAULT FALSE,
    combinable_discounts UUID[],
    priority INTEGER DEFAULT 0,
    conditions JSONB DEFAULT '{}',
    analytics JSONB DEFAULT '{}',
    created_by UUID NOT NULL,
    last_modified_by UUID,
    tags TEXT[],
    notes TEXT,
    audit_trail JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code);
CREATE INDEX IF NOT EXISTS idx_discounts_is_active ON discounts(is_active);
CREATE INDEX IF NOT EXISTS idx_discounts_valid_dates ON discounts(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_discounts_type ON discounts(type);

-- ============================================
-- INVESTORS
-- ============================================
CREATE TABLE IF NOT EXISTS investors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    address JSONB,
    total_investment DECIMAL(15, 2) DEFAULT 0,
    default_profit_share_percentage DECIMAL(5, 2) DEFAULT 30 CHECK (default_profit_share_percentage >= 0 AND default_profit_share_percentage <= 100),
    total_earned_profit DECIMAL(15, 2) DEFAULT 0,
    total_paid_out DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    notes VARCHAR(1000),
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_investors_email ON investors(email);
CREATE INDEX IF NOT EXISTS idx_investors_status ON investors(status);
CREATE INDEX IF NOT EXISTS idx_investors_deleted_at ON investors(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- NOTES
-- ============================================
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('Customer', 'Product', 'SalesOrder', 'PurchaseOrder', 'Supplier', 'Sale', 'PurchaseInvoice', 'SalesInvoice')),
    entity_id UUID NOT NULL,
    content TEXT NOT NULL,
    html_content TEXT DEFAULT '',
    is_private BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL,
    mentions JSONB DEFAULT '[]',
    tags TEXT[],
    history JSONB DEFAULT '[]',
    is_pinned BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity_type, entity_id, status);
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON notes(created_by);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

-- ============================================
-- PURCHASE ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number VARCHAR(100) NOT NULL UNIQUE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    items JSONB NOT NULL DEFAULT '[]',
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    tax DECIMAL(15, 2) DEFAULT 0,
    is_tax_exempt BOOLEAN DEFAULT TRUE,
    total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'partially_received', 'fully_received', 'cancelled', 'closed')),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_delivery TIMESTAMP,
    confirmed_date TIMESTAMP,
    last_received_date TIMESTAMP,
    notes TEXT,
    terms TEXT,
    conversions JSONB DEFAULT '[]',
    ledger_posted BOOLEAN DEFAULT FALSE,
    auto_posted BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMP,
    ledger_reference_id UUID,
    auto_converted BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL,
    last_modified_by UUID,
    is_auto_generated BOOLEAN DEFAULT FALSE,
    auto_generated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date ON purchase_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_deleted_at ON purchase_orders(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- PURCHASE INVOICES
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(100) UNIQUE,
    invoice_type VARCHAR(20) DEFAULT 'purchase' CHECK (invoice_type IN ('purchase', 'return', 'adjustment')),
    supplier_id UUID REFERENCES suppliers(id),
    supplier_info JSONB,
    items JSONB NOT NULL DEFAULT '[]',
    pricing JSONB NOT NULL DEFAULT '{}',
    payment JSONB DEFAULT '{}',
    expected_delivery TIMESTAMP,
    actual_delivery TIMESTAMP,
    notes TEXT,
    terms TEXT,
    invoice_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'received', 'paid', 'cancelled', 'closed')),
    confirmed_date TIMESTAMP,
    received_date TIMESTAMP,
    ledger_posted BOOLEAN DEFAULT FALSE,
    auto_posted BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMP,
    ledger_reference_id UUID,
    last_modified_by UUID,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_invoice_number ON purchase_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status ON purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_invoice_date ON purchase_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_deleted_at ON purchase_invoices(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- SALES ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    so_number VARCHAR(100) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    items JSONB NOT NULL DEFAULT '[]',
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    tax DECIMAL(15, 2) DEFAULT 0,
    is_tax_exempt BOOLEAN DEFAULT TRUE,
    total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'partially_invoiced', 'fully_invoiced', 'cancelled', 'closed')),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_delivery TIMESTAMP,
    confirmed_date TIMESTAMP,
    last_invoiced_date TIMESTAMP,
    notes TEXT,
    terms TEXT,
    conversions JSONB DEFAULT '[]',
    ledger_posted BOOLEAN DEFAULT FALSE,
    auto_posted BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMP,
    ledger_reference_id UUID,
    invoice_id UUID REFERENCES sales(id),
    auto_converted BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL,
    last_modified_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sales_orders_so_number ON sales_orders(so_number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_deleted_at ON sales_orders(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- INVENTORY
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL,
    product_model VARCHAR(50) NOT NULL DEFAULT 'Product' CHECK (product_model IN ('Product', 'ProductVariant')),
    current_stock DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    reserved_stock DECIMAL(10, 2) DEFAULT 0 CHECK (reserved_stock >= 0),
    available_stock DECIMAL(10, 2) DEFAULT 0 CHECK (available_stock >= 0),
    reservations JSONB DEFAULT '[]',
    reorder_point DECIMAL(10, 2) NOT NULL DEFAULT 10,
    reorder_quantity DECIMAL(10, 2) NOT NULL DEFAULT 50,
    max_stock DECIMAL(10, 2),
    location JSONB DEFAULT '{}',
    cost JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued', 'out_of_stock')),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_count JSONB,
    movements JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(product_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_current_stock ON inventory(current_stock);
CREATE INDEX IF NOT EXISTS idx_inventory_deleted_at ON inventory(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- STOCK MOVEMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'return_in', 'return_out', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out', 'damage', 'expiry', 'theft', 'production', 'consumption', 'initial_stock')),
    quantity DECIMAL(15, 2) NOT NULL CHECK (quantity >= 0),
    unit_cost DECIMAL(15, 2) NOT NULL CHECK (unit_cost >= 0),
    total_value DECIMAL(15, 2) NOT NULL CHECK (total_value >= 0),
    previous_stock DECIMAL(15, 2) NOT NULL CHECK (previous_stock >= 0),
    new_stock DECIMAL(15, 2) NOT NULL CHECK (new_stock >= 0),
    reference_type VARCHAR(30) NOT NULL CHECK (reference_type IN ('purchase_order', 'sales_order', 'return', 'adjustment', 'transfer', 'production', 'manual_entry', 'system_generated')),
    reference_id UUID NOT NULL,
    reference_number VARCHAR(100),
    location VARCHAR(100) DEFAULT 'main_warehouse',
    from_location VARCHAR(100),
    to_location VARCHAR(100),
    user_id UUID NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    reason TEXT,
    notes VARCHAR(1000),
    batch_number VARCHAR(100),
    expiry_date DATE,
    supplier_id UUID REFERENCES suppliers(id),
    customer_id UUID REFERENCES customers(id),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'reversed')),
    is_reversal BOOLEAN DEFAULT FALSE,
    original_movement_id UUID REFERENCES stock_movements(id),
    reversed_by UUID,
    reversed_at TIMESTAMP,
    system_generated BOOLEAN DEFAULT FALSE,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);

-- ============================================
-- STOCK ADJUSTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adjustment_number VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('physical_count', 'damage', 'theft', 'transfer', 'correction', 'return', 'write_off')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    reason TEXT NOT NULL,
    adjustments JSONB NOT NULL DEFAULT '[]',
    total_variance DECIMAL(15, 2) DEFAULT 0,
    total_cost_impact DECIMAL(15, 2) DEFAULT 0,
    warehouse VARCHAR(100) DEFAULT 'Main Warehouse',
    requested_by UUID NOT NULL,
    approved_by UUID,
    completed_by UUID,
    requested_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_date TIMESTAMP,
    completed_date TIMESTAMP,
    notes TEXT,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_number ON stock_adjustments(adjustment_number);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_status ON stock_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_type ON stock_adjustments(type);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_requested_date ON stock_adjustments(requested_date DESC);

-- ============================================
-- PRODUCT VARIANTS
-- ============================================
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_name VARCHAR(200) NOT NULL,
    variant_type VARCHAR(20) NOT NULL CHECK (variant_type IN ('color', 'warranty', 'size', 'finish', 'custom')),
    variant_value VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description VARCHAR(1000),
    pricing JSONB NOT NULL DEFAULT '{}',
    transformation_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
    inventory_data JSONB DEFAULT '{}',
    sku VARCHAR(100),
    barcode VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_variants_base_product ON product_variants(base_product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_deleted_at ON product_variants(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- PRODUCT TRANSFORMATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS product_transformations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transformation_number VARCHAR(100) UNIQUE,
    base_product_id UUID NOT NULL REFERENCES products(id),
    base_product_name VARCHAR(255) NOT NULL,
    target_variant_id UUID NOT NULL REFERENCES product_variants(id),
    target_variant_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 1),
    unit_transformation_cost DECIMAL(15, 2) NOT NULL CHECK (unit_transformation_cost >= 0),
    total_transformation_cost DECIMAL(15, 2) NOT NULL CHECK (total_transformation_cost >= 0),
    base_product_stock_before INTEGER NOT NULL CHECK (base_product_stock_before >= 0),
    base_product_stock_after INTEGER NOT NULL CHECK (base_product_stock_after >= 0),
    variant_stock_before INTEGER NOT NULL CHECK (variant_stock_before >= 0),
    variant_stock_after INTEGER NOT NULL CHECK (variant_stock_after >= 0),
    transformation_type VARCHAR(20) NOT NULL CHECK (transformation_type IN ('color', 'warranty', 'size', 'finish', 'custom')),
    notes VARCHAR(1000),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'failed')),
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_transformations_number ON product_transformations(transformation_number);
CREATE INDEX IF NOT EXISTS idx_product_transformations_base_product ON product_transformations(base_product_id);
CREATE INDEX IF NOT EXISTS idx_product_transformations_target_variant ON product_transformations(target_variant_id);
CREATE INDEX IF NOT EXISTS idx_product_transformations_status ON product_transformations(status);

-- ============================================
-- PAYMENTS (sales payment records)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id VARCHAR(100) NOT NULL UNIQUE,
    order_id UUID NOT NULL REFERENCES sales(id),
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('cash', 'credit_card', 'debit_card', 'digital_wallet', 'bank_transfer', 'check', 'gift_card', 'store_credit')),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
    transaction_id VARCHAR(100),
    gateway JSONB DEFAULT '{}',
    processing JSONB DEFAULT '{}',
    card_details JSONB DEFAULT '{}',
    wallet_details JSONB DEFAULT '{}',
    refunds JSONB DEFAULT '[]',
    fees JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    security JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- ============================================
-- BACKUPS
-- ============================================
CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backup_id VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('full', 'incremental', 'differential', 'schema_only', 'data_only')),
    schedule VARCHAR(20) NOT NULL CHECK (schedule IN ('hourly', 'daily', 'weekly', 'monthly', 'manual')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    database_info JSONB DEFAULT '{}',
    collections JSONB DEFAULT '[]',
    files JSONB DEFAULT '{}',
    compression JSONB DEFAULT '{}',
    encryption JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    retention JSONB DEFAULT '{}',
    verification JSONB DEFAULT '{}',
    triggered_by UUID,
    trigger_reason VARCHAR(30) CHECK (trigger_reason IN ('scheduled', 'manual', 'system', 'error_recovery')),
    notifications JSONB DEFAULT '[]',
    error_info JSONB,
    tags TEXT[],
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_backups_backup_id ON backups(backup_id);
CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);

-- ============================================
-- DROP SHIPPING
-- ============================================
CREATE TABLE IF NOT EXISTS drop_shipping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(100) NOT NULL UNIQUE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    supplier_info JSONB,
    bill_number VARCHAR(100),
    supplier_description TEXT,
    customer_id UUID REFERENCES customers(id),
    customer_info JSONB,
    items JSONB NOT NULL DEFAULT '[]',
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    tax DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    supplier_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    profit_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_drop_shipping_transaction_number ON drop_shipping(transaction_number);
CREATE INDEX IF NOT EXISTS idx_drop_shipping_supplier ON drop_shipping(supplier_id);
CREATE INDEX IF NOT EXISTS idx_drop_shipping_status ON drop_shipping(status);
CREATE INDEX IF NOT EXISTS idx_drop_shipping_deleted_at ON drop_shipping(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- RECURRING EXPENSES
-- ============================================
CREATE TABLE IF NOT EXISTS recurring_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description VARCHAR(1000),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    frequency VARCHAR(20) DEFAULT 'monthly' CHECK (frequency IN ('monthly')),
    day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
    next_due_date DATE NOT NULL,
    reminder_days_before INTEGER DEFAULT 3 CHECK (reminder_days_before >= 0 AND reminder_days_before <= 31),
    last_reminder_sent_at TIMESTAMP,
    last_paid_at TIMESTAMP,
    supplier_id UUID REFERENCES suppliers(id),
    customer_id UUID REFERENCES customers(id),
    expense_account_id UUID REFERENCES chart_of_accounts(id),
    default_payment_type VARCHAR(10) DEFAULT 'cash' CHECK (default_payment_type IN ('cash', 'bank')),
    bank_id UUID REFERENCES banks(id),
    notes VARCHAR(1000),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    tags TEXT[],
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_status ON recurring_expenses(status);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_due ON recurring_expenses(next_due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_deleted_at ON recurring_expenses(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- PROFIT SHARES
-- ============================================
CREATE TABLE IF NOT EXISTS profit_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES sales(id),
    order_number VARCHAR(100) NOT NULL,
    order_date TIMESTAMP NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(15, 2) NOT NULL CHECK (quantity >= 1),
    sale_amount DECIMAL(15, 2) NOT NULL CHECK (sale_amount >= 0),
    total_cost DECIMAL(15, 2) NOT NULL CHECK (total_cost >= 0),
    total_profit DECIMAL(15, 2) NOT NULL,
    investor_share DECIMAL(15, 2) NOT NULL DEFAULT 0,
    company_share DECIMAL(15, 2) NOT NULL DEFAULT 0,
    investor_share_percentage DECIMAL(5, 2) DEFAULT 30,
    company_share_percentage DECIMAL(5, 2) DEFAULT 70,
    investor_id UUID REFERENCES investors(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_profit_shares_order ON profit_shares(order_id);
CREATE INDEX IF NOT EXISTS idx_profit_shares_product ON profit_shares(product_id);
CREATE INDEX IF NOT EXISTS idx_profit_shares_investor ON profit_shares(investor_id);

-- ============================================
-- RECOMMENDATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    customer_id UUID REFERENCES customers(id),
    session_id VARCHAR(100) NOT NULL,
    algorithm VARCHAR(50) NOT NULL CHECK (algorithm IN ('collaborative', 'content_based', 'hybrid', 'trending', 'frequently_bought', 'similar_products', 'seasonal', 'price_based')),
    context JSONB DEFAULT '{}',
    recommendations JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recommendations_session ON recommendations(session_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_algorithm ON recommendations(algorithm);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(created_at DESC);

-- ============================================
-- INVENTORY REPORTS
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id VARCHAR(100) NOT NULL UNIQUE,
    report_name VARCHAR(200) NOT NULL,
    report_type VARCHAR(30) NOT NULL CHECK (report_type IN ('stock_levels', 'turnover_rates', 'aging_analysis', 'comprehensive', 'custom')),
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    config JSONB DEFAULT '{}',
    stock_levels JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inventory_reports_report_id ON inventory_reports(report_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reports_dates ON inventory_reports(start_date, end_date);

-- ============================================
-- SALES PERFORMANCE
-- ============================================
CREATE TABLE IF NOT EXISTS sales_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id VARCHAR(100) NOT NULL UNIQUE,
    report_name VARCHAR(200) NOT NULL,
    report_type VARCHAR(30) NOT NULL CHECK (report_type IN ('top_products', 'top_customers', 'top_sales_reps', 'comprehensive', 'custom')),
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sales_performance_report_id ON sales_performance(report_id);
CREATE INDEX IF NOT EXISTS idx_sales_performance_dates ON sales_performance(start_date, end_date);

-- ============================================
-- TRIGGERS (update_updated_at)
-- ============================================
CREATE TRIGGER update_account_categories_updated_at BEFORE UPDATE ON account_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_banks_updated_at BEFORE UPDATE ON banks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cities_updated_at BEFORE UPDATE ON cities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_till_sessions_updated_at BEFORE UPDATE ON till_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discounts_updated_at BEFORE UPDATE ON discounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_investors_updated_at BEFORE UPDATE ON investors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_invoices_updated_at BEFORE UPDATE ON purchase_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON sales_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stock_movements_updated_at BEFORE UPDATE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_transformations_updated_at BEFORE UPDATE ON product_transformations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_backups_updated_at BEFORE UPDATE ON backups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drop_shipping_updated_at BEFORE UPDATE ON drop_shipping
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recurring_expenses_updated_at BEFORE UPDATE ON recurring_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
