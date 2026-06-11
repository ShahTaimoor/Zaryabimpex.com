import {
  LayoutDashboard, ShoppingCart, Shield, Truck, Database, Warehouse, Wallet,
  ClipboardList, BarChart3, Users, Settings as SettingsIcon,
} from 'lucide-react';

export const PAGE_PERMISSION_GROUPS = {
    dashboard: {
      name: 'Dashboard',
      icon: LayoutDashboard,
      pages: [
        { key: 'dashboard', name: 'Dashboard', view: 'view_dashboard' }
      ]
    },
    sales: {
      name: 'Sales',
      icon: ShoppingCart,
      pages: [
        { key: 'sales-orders', name: 'Sales Orders', view: 'view_sales_orders', create: 'create_sales_orders', edit: 'edit_sales_orders', delete: 'delete_sales_orders', confirm: 'confirm_sales_orders', cancel: 'cancel_sales_orders' },
        { key: 'sales', name: 'Sales', view: 'view_sales', create: 'create_sales_invoices', edit: 'edit_sales_invoices', delete: 'void_sales_invoices' },
        { key: 'sale-returns', name: 'Sale Returns', view: 'view_sale_returns', create: 'create_sale_returns', edit: 'edit_sale_returns', delete: 'delete_sale_returns' }
      ]
    },
    advanced: {
      name: 'Advanced',
      icon: Shield,
      pages: [],
      extraPermissions: [
        { key: 'view_product_costs', name: 'Show Cost Price' },
        { key: 'view_bp', name: 'Show BP' },
        { key: 'apply_last_prices', name: 'Apply Last Price' },
        { key: 'view_customer_balance', name: 'Show Customer Balance' },
        { key: 'view_supplier_balance', name: 'Show Supplier Balance' },
        { key: 'view_stock_levels', name: 'Show Stock' },
        { key: 'view_customer_phone', name: 'Show Customer Phone' },
        { key: 'view_supplier_phone', name: 'Show Supplier Phone' }
      ]
    },
    purchase: {
      name: 'Purchase',
      icon: Truck,
      pages: [
        { key: 'purchase-orders', name: 'Purchase Orders', view: 'view_purchase_orders', create: 'create_purchase_orders', edit: 'edit_purchase_orders', delete: 'delete_purchase_orders' },
        { key: 'purchase', name: 'Purchase', view: 'view_purchase_invoices', create: 'create_purchase_invoices', edit: 'edit_purchase_invoices', delete: 'delete_purchase_invoices' },
        { key: 'import-purchase', name: 'Import Purchase', view: 'view_import_purchase', create: 'create_import_purchase', edit: 'edit_import_purchase', delete: 'delete_import_purchase' },
        { key: 'purchase-returns', name: 'Purchase Returns', view: 'view_purchase_returns', create: 'create_purchase_returns', edit: 'edit_purchase_returns', delete: 'delete_purchase_returns' },
        { key: 'market-prices', name: 'Market Prices', view: 'view_market_prices', create: 'create_market_prices', edit: 'edit_market_prices', delete: 'delete_market_prices' }
      ]
    },
    masterData: {
      name: 'Master Data',
      icon: Database,
      pages: [
        { key: 'products', name: 'Products', view: 'view_products', create: 'create_products', edit: 'edit_products', delete: 'delete_products' },
        { key: 'product-variants', name: 'Product Variants', view: 'view_product_variants', create: 'create_product_variants', edit: 'edit_product_variants', delete: 'delete_product_variants' },
        { key: 'product-transformations', name: 'Product Transformations', view: 'view_product_transformations', create: 'create_product_transformations', edit: 'edit_product_transformations', delete: 'delete_product_transformations' },
        { key: 'categories', name: 'Categories', view: 'view_product_categories', create: 'create_categories', edit: 'edit_categories', delete: 'delete_categories' },
        { key: 'customers', name: 'Customers', view: 'view_customers', create: 'create_customers', edit: 'edit_customers', delete: 'delete_customers' },
        { key: 'suppliers', name: 'Suppliers', view: 'view_suppliers', create: 'create_suppliers', edit: 'edit_suppliers', delete: 'delete_suppliers' },
        { key: 'discounts', name: 'Discounts', view: 'view_discounts', create: 'create_discounts', edit: 'edit_discounts', delete: 'delete_discounts' },
        { key: 'investors', name: 'Investors', view: 'view_investors', create: 'create_investors', edit: 'edit_investors', delete: 'delete_investors' },
        { key: 'drop-shipping', name: 'Drop Shipping', view: 'view_drop_shipping', create: 'create_drop_shipping', edit: 'edit_drop_shipping', delete: 'delete_drop_shipping' },
        { key: 'cities', name: 'Cities', view: 'view_cities', create: 'create_cities', edit: 'edit_cities', delete: 'delete_cities' },
        { key: 'banks', name: 'Bank & Cash Opening', view: 'view_banks', create: 'create_banks', edit: 'edit_banks', delete: 'delete_banks' },
        { key: 'cctv-access', name: 'CCTV Access', view: 'view_cctv_access' }
      ]
    },
    inventory: {
      name: 'Inventory',
      icon: Warehouse,
      pages: [
        { key: 'inventory', name: 'Inventory', view: 'view_inventory', create: 'create_inventory', edit: 'edit_inventory', delete: 'delete_inventory' },
        { key: 'warehouses', name: 'Warehouses', view: 'view_warehouses', create: 'create_warehouses', edit: 'edit_warehouses', delete: 'delete_warehouses' },
        { key: 'stock-movements', name: 'Stock Movements', view: 'view_stock_movements' },
        { key: 'stock-transfers', name: 'Stock Transfers', view: 'manage_inventory' },
        { key: 'stock-ledger', name: 'Stock Ledger', view: 'view_inventory_levels' },
        { key: 'inventory-alerts', name: 'Inventory Alerts', view: 'view_low_stock_alerts' }
      ]
    },
    financials: {
      name: 'Financials',
      icon: Wallet,
      pages: [
        { key: 'cash-receiving', name: 'Multi Cash Receipt', view: 'view_cash_receiving', create: 'create_cash_receiving', edit: 'edit_cash_receiving', delete: 'delete_cash_receiving' },
        { key: 'cash-receipts', name: 'Cash Receipts', view: 'view_cash_receipts', create: 'create_cash_receipts', edit: 'edit_cash_receipts', delete: 'delete_cash_receipts' },
        { key: 'cash-payments', name: 'Cash Payments', view: 'view_cash_payments', create: 'create_cash_payments', edit: 'edit_cash_payments', delete: 'delete_cash_payments' },
        { key: 'bank-receipts', name: 'Bank Receipts', view: 'view_bank_receipts', create: 'create_bank_receipts', edit: 'edit_bank_receipts', delete: 'delete_bank_receipts' },
        { key: 'bank-payments', name: 'Bank Payments', view: 'view_bank_payments', create: 'create_bank_payments', edit: 'edit_bank_payments', delete: 'delete_bank_payments' },
        { key: 'expenses', name: 'Expenses', view: 'view_expenses', create: 'create_expenses', edit: 'edit_expenses', delete: 'delete_expenses' },
        { key: 'till', name: 'Till Management (Admin)', view: 'view_till', create: 'open_till', edit: 'close_till' }
      ]
    },
    accounting: {
      name: 'Accounting',
      icon: ClipboardList,
      pages: [
        { key: 'chart-of-accounts', name: 'Chart of Accounts', view: 'view_chart_of_accounts', create: 'create_chart_of_accounts', edit: 'edit_chart_of_accounts', delete: 'delete_chart_of_accounts' },
        { key: 'journal-vouchers', name: 'Journal Vouchers', view: 'view_journal_vouchers', create: 'create_journal_vouchers', edit: 'edit_journal_vouchers', delete: 'delete_journal_vouchers' },
        { key: 'account-ledger', name: 'Account Ledger Summary', view: 'view_accounting_summary' }
      ]
    },
    analytics: {
      name: 'Analytics',
      icon: BarChart3,
      pages: [
        { key: 'pl-statements', name: 'P&L Statements', view: 'view_pl_statements' },
        { key: 'balance-sheet', name: 'Balance Sheet', view: 'view_balance_sheets' },
        { key: 'reports', name: 'Reports', view: 'view_general_reports' },
        { key: 'backdate-report', name: 'Backdate Report', view: 'view_backdate_report' },
        { key: 'customer-analytics', name: 'Customer Analytics', view: 'view_customer_analytics' },
        { key: 'anomaly-detection', name: 'Anomaly Detection', view: 'view_anomaly_detection' }
      ]
    },
    hr: {
      name: 'HR / Admin',
      icon: Users,
      pages: [
        { key: 'employees', name: 'Employees', view: 'manage_users', create: 'create_users', edit: 'edit_users', delete: 'delete_users' },
        { key: 'attendance', name: 'Attendance', view: 'view_own_attendance', create: 'clock_in', edit: 'manage_attendance_breaks', delete: 'delete_attendance' }
      ],
      extraPermissions: [
        { key: 'end_session', name: 'End Session' }
      ]
    },
    settingsConfig: {
      name: 'Settings Config',
      icon: SettingsIcon,
      pages: [
        { key: 'print-settings', name: 'Print Preview', view: 'manage_print_settings', edit: 'manage_print_settings' },
        { key: 'product-settings', name: 'Product Settings', view: 'manage_product_settings', edit: 'manage_product_settings' },
        { key: 'customer-settings', name: 'Customer Settings', view: 'manage_customer_settings', edit: 'manage_customer_settings' },
        { key: 'supplier-settings', name: 'Supplier Settings', view: 'manage_supplier_settings', edit: 'manage_supplier_settings' },
        { key: 'advanced-settings', name: 'Advanced Features', view: 'manage_advanced_settings', edit: 'manage_advanced_settings' }
      ],
      extraPermissions: [
        { key: 'settings_print_layout', name: 'Print — Layout & Size' },
        { key: 'settings_print_logo_header', name: 'Print — Logo & Header' },
        { key: 'settings_print_party_details', name: 'Print — Party / Billing Details' },
        { key: 'settings_print_invoice_meta', name: 'Print — Invoice Meta & Payment' },
        { key: 'settings_print_financials', name: 'Print — Financials & Table' },
        { key: 'settings_print_behavior', name: 'Print — Post-Print Behavior' },
        { key: 'settings_product_images', name: 'Products — Image Visibility' },
        { key: 'settings_product_fields', name: 'Products — Field Visibility' },
        { key: 'settings_customer_fields', name: 'Customers — Field Visibility' },
        { key: 'settings_supplier_fields', name: 'Suppliers — Field Visibility' },
        { key: 'settings_advanced_display', name: 'Advanced — Display Options' },
        { key: 'settings_advanced_features', name: 'Advanced — Feature Toggles' },
        { key: 'settings_advanced_security', name: 'Advanced — Security (2FA)' }
      ]
    },
    system: {
      name: 'System',
      icon: SettingsIcon,
      pages: [
        { key: 'settings', name: 'Settings', view: 'view_settings', edit: 'edit_settings' },
        { key: 'print-preview', name: 'Print Preview', view: 'manage_print_settings' },
        { key: 'migration', name: 'Migration', view: 'view_migration', create: 'run_migration' },
        { key: 'help', name: 'Help', view: 'view_help' }
      ]
    }
  };

const allPagePermissionDefaults = Object.values(PAGE_PERMISSION_GROUPS).reduce((acc, group) => {
    group.pages.forEach((page) => {
      ['view', 'create', 'edit', 'delete', 'confirm', 'cancel'].forEach((action) => {
        if (page[action]) acc[page[action]] = true;
      });
    });
    (group.extraPermissions || []).forEach((permission) => {
      acc[permission.key] = true;
    });
    return acc;
  }, {});

export const DEFAULT_ROLE_PERMISSIONS = {
    admin: {
      ...allPagePermissionDefaults,
      // Products
      view_products: true, create_products: true, edit_products: true, delete_products: true,
      view_product_list: true, view_product_details: true, view_product_categories: true, view_product_inventory: true,
      // Customers
      view_customers: true, create_customers: true, edit_customers: true, delete_customers: true,
      view_customer_list: true, view_customer_details: true, view_customer_history: true, view_customer_balance: true,
      // Suppliers
      view_suppliers: true, create_suppliers: true, edit_suppliers: true, delete_suppliers: true,
      view_supplier_list: true, view_supplier_details: true, view_supplier_orders: true, view_supplier_balance: true,
      // Orders
      view_orders: true, create_orders: true, edit_orders: true, cancel_orders: true,
      view_sales_orders: true, view_purchase_orders: true, view_sales_invoices: true, view_purchase_invoices: true,
      view_product_costs: true, view_bp: true, apply_last_prices: true, manage_sales: true,
      // Advanced (sensitive globals)
      view_stock_levels: true,
      view_customer_phone: true, view_supplier_phone: true,
      // Inventory
      view_inventory: true, update_inventory: true, manage_inventory: true,
      view_inventory_levels: true, view_stock_movements: true, view_low_stock_alerts: true,
      update_stock_quantities: true, create_stock_adjustments: true, process_receipts: true,
      // Returns
      view_returns: true, create_returns: true, edit_returns: true, approve_returns: true, process_returns: true,
      view_return_requests: true, view_return_history: true, view_return_reasons: true,
      // Discounts
      view_discounts: true, manage_discounts: true,
      view_discount_list: true, view_discount_rules: true, view_discount_history: true,
      create_discounts: true, edit_discounts: true, delete_discounts: true,
      // Reports & Analytics
      view_reports: true, view_analytics: true, view_recommendations: true,
      view_pl_statements: true, view_balance_sheets: true,
      view_general_reports: true, view_backdate_report: true,
      view_customer_analytics: true, view_anomaly_detection: true, view_financial_data: true,
      share_reports: true, schedule_reports: true, view_advanced_analytics: true,
      // Financial Operations
      view_cash_receipts: true, create_cash_receipts: true, edit_cash_receipts: true, delete_cash_receipts: true,
      view_cash_payments: true, create_cash_payments: true, edit_cash_payments: true, delete_cash_payments: true,
      view_bank_receipts: true, create_bank_receipts: true, edit_bank_receipts: true, delete_bank_receipts: true,
      view_bank_payments: true, create_bank_payments: true, edit_bank_payments: true, delete_bank_payments: true,
      view_expenses: true, create_expenses: true, edit_expenses: true, delete_expenses: true, approve_expenses: true,
      // Purchase Operations - Granular
      create_purchase_orders: true, edit_purchase_orders: true, delete_purchase_orders: true,
      approve_purchase_orders: true, reject_purchase_orders: true, receive_purchase_orders: true,
      create_purchase_invoices: true, edit_purchase_invoices: true, delete_purchase_invoices: true,
      // Sales Operations - Granular
      create_sales_orders: true, edit_sales_orders: true, delete_sales_orders: true,
      approve_sales_orders: true, reject_sales_orders: true,
      confirm_sales_orders: true, cancel_sales_orders: true,
      create_sales_invoices: true, edit_sales_invoices: true, void_sales_invoices: true,
      apply_discounts: true, override_prices: true,
      // Inventory Operations - Granular
      generate_purchase_orders: true, acknowledge_inventory_alerts: true,
      import_inventory_data: true,
      // Accounting
      view_accounting_transactions: true, view_accounting_accounts: true, view_trial_balance: true,
      update_balance_sheet: true, view_chart_of_accounts: true, view_accounting_summary: true,
      manage_accounting: true,
      // Attendance
      clock_attendance: true, clock_in: true, clock_out: true, manage_attendance_breaks: true,
      view_own_attendance: true, view_team_attendance: true,
      // Till Management
      open_till: true, close_till: true, view_till: true,
      // Investor Management
      view_investors: true, manage_investors: true, create_investors: true, edit_investors: true, payout_investors: true,
      // Administration
      manage_users: true, manage_settings: true,
      manage_print_settings: true, manage_product_settings: true, manage_customer_settings: true,
      manage_supplier_settings: true, manage_advanced_settings: true,
      settings_print_layout: true, settings_print_logo_header: true, settings_print_party_details: true,
      settings_print_invoice_meta: true, settings_print_financials: true, settings_print_behavior: true,
      settings_product_images: true, settings_product_fields: true,
      settings_customer_fields: true, settings_supplier_fields: true,
      settings_advanced_display: true, settings_advanced_features: true, settings_advanced_security: true,
      create_users: true, edit_users: true, delete_users: true, assign_roles: true, end_session: true,
      company_settings: true, system_settings: true, print_settings: true, security_settings: true,
      view_audit_logs: true, import_data: true,
      manage_integrations: true, configure_notifications: true
    },
    manager: {
      // Products - Full access except delete
      view_products: true, create_products: true, edit_products: true,
      view_product_list: true, view_product_details: true, view_product_categories: true, view_product_inventory: true,
      view_product_variants: true, create_product_variants: true, edit_product_variants: true,
      view_product_transformations: true, create_product_transformations: true, edit_product_transformations: true,
      create_categories: true, edit_categories: true,
      // Customers - Full access
      view_customers: true, create_customers: true, edit_customers: true, delete_customers: true,
      view_customer_list: true, view_customer_details: true, view_customer_history: true, view_customer_balance: true,
      // Suppliers - Full access
      view_suppliers: true, create_suppliers: true, edit_suppliers: true, delete_suppliers: true,
      view_supplier_list: true, view_supplier_details: true, view_supplier_orders: true, view_supplier_balance: true,
      // Orders - Full access
      view_orders: true, create_orders: true, edit_orders: true, cancel_orders: true,
      view_sales: true, view_sales_orders: true, view_purchase_orders: true, view_sales_invoices: true, view_purchase_invoices: true,
      view_product_costs: true, view_bp: true, apply_last_prices: true, manage_sales: true,
      // Advanced (sensitive globals)
      view_stock_levels: true,
      view_customer_phone: true, view_supplier_phone: true,
      // Inventory - Full access
      view_inventory: true, update_inventory: true, manage_inventory: true,
      view_inventory_levels: true, view_stock_movements: true, view_low_stock_alerts: true, view_warehouses: true,
      create_inventory: true, edit_inventory: true, create_warehouses: true, edit_warehouses: true,
      update_stock_quantities: true, create_stock_adjustments: true, process_receipts: true,
      // Returns - Full access
      view_returns: true, create_returns: true, edit_returns: true, approve_returns: true, process_returns: true,
      view_return_requests: true, view_return_history: true, view_return_reasons: true,
      view_sale_returns: true, create_sale_returns: true, edit_sale_returns: true, delete_sale_returns: true,
      view_purchase_returns: true, create_purchase_returns: true, edit_purchase_returns: true, delete_purchase_returns: true,
      // Discounts - Full access
      view_discounts: true, manage_discounts: true,
      view_discount_list: true, view_discount_rules: true, view_discount_history: true,
      create_discounts: true, edit_discounts: true, delete_discounts: true,
      // Reports & Analytics - Full access
      view_reports: true, view_analytics: true, view_recommendations: true,
      view_pl_statements: true, view_balance_sheets: true,
      view_general_reports: true, view_backdate_report: true,
      view_customer_analytics: true, view_anomaly_detection: true, view_financial_data: true,
      share_reports: true, schedule_reports: true, view_advanced_analytics: true,
      // Financial Operations
      view_cash_receiving: true, create_cash_receiving: true, edit_cash_receiving: true, delete_cash_receiving: true,
      view_cash_receipts: true, create_cash_receipts: true, edit_cash_receipts: true, delete_cash_receipts: true,
      view_cash_payments: true, create_cash_payments: true, edit_cash_payments: true, delete_cash_payments: true,
      view_bank_receipts: true, create_bank_receipts: true, edit_bank_receipts: true, delete_bank_receipts: true,
      view_bank_payments: true, create_bank_payments: true, edit_bank_payments: true, delete_bank_payments: true,
      view_expenses: true, create_expenses: true, edit_expenses: true, delete_expenses: true, approve_expenses: true,
      // Purchase Operations - Granular
      create_purchase_orders: true, edit_purchase_orders: true, delete_purchase_orders: true,
      approve_purchase_orders: true, reject_purchase_orders: true, receive_purchase_orders: true,
      create_purchase_invoices: true, edit_purchase_invoices: true, delete_purchase_invoices: true,
      view_import_purchase: true, create_import_purchase: true, edit_import_purchase: true, delete_import_purchase: true,
      view_market_prices: true, create_market_prices: true, edit_market_prices: true,
      // Sales Operations - Granular
      create_sales_orders: true, edit_sales_orders: true, delete_sales_orders: true,
      approve_sales_orders: true, reject_sales_orders: true,
      confirm_sales_orders: true, cancel_sales_orders: true,
      create_sales_invoices: true, edit_sales_invoices: true, void_sales_invoices: true,
      apply_discounts: true, override_prices: true,
      // Inventory Operations - Granular
      generate_purchase_orders: true, acknowledge_inventory_alerts: true,
      import_inventory_data: true,
      // Accounting
      view_accounting_transactions: true, view_accounting_accounts: true, view_trial_balance: true,
      update_balance_sheet: true, view_chart_of_accounts: true, view_accounting_summary: true,
      view_journal_vouchers: true, create_journal_vouchers: true, edit_journal_vouchers: true,
      // Attendance
      clock_attendance: true, clock_in: true, clock_out: true, manage_attendance_breaks: true,
      view_own_attendance: true, view_team_attendance: true,
      // Investor Management
      view_investors: true, manage_investors: true, create_investors: true, edit_investors: true, payout_investors: true,
      view_drop_shipping: true, create_drop_shipping: true, edit_drop_shipping: true,
      view_banks: true, create_banks: true, edit_banks: true,
      view_cctv_access: true, view_cities: true, create_cities: true, edit_cities: true,
      manage_print_settings: true, manage_product_settings: true, manage_customer_settings: true,
      manage_supplier_settings: true, manage_advanced_settings: true,
      settings_print_layout: true, settings_print_logo_header: true, settings_print_party_details: true,
      settings_print_invoice_meta: true, settings_print_financials: true, settings_print_behavior: true,
      settings_product_images: true, settings_product_fields: true,
      settings_customer_fields: true, settings_supplier_fields: true,
      settings_advanced_display: true, settings_advanced_features: true, settings_advanced_security: true,
      view_help: true
    },
    cashier: {
      // Dashboard
      view_dashboard: true,
      // Products - View only
      view_products: true,
      view_product_list: true, view_product_details: true,
      view_product_categories: true,
      // Customers - View, create, edit
      view_customers: true, create_customers: true, edit_customers: true,
      view_customer_list: true, view_customer_details: true,
      // Sales pages - View + create
      view_orders: true, create_orders: true,
      view_sales: true, view_sales_orders: true, view_sales_invoices: true,
      create_sales_orders: true, edit_sales_orders: true,
      confirm_sales_orders: true,
      create_sales_invoices: true, edit_sales_invoices: true,
      apply_last_prices: true,
      manage_sales: true,
      // Sale Returns
      view_returns: true, process_returns: true, create_returns: true,
      view_sale_returns: true, create_sale_returns: true, edit_sale_returns: true,
      view_return_requests: true, view_return_history: true,
      // Inventory - View levels & stock movements
      view_inventory: true,
      view_inventory_levels: true, view_stock_movements: true,
      // Discounts - View only
      view_discounts: true,
      view_discount_list: true, apply_discounts: true,
      // Financials - Multi Cash Receipt
      view_cash_receiving: true, create_cash_receiving: true,
      view_cash_receipts: true, create_cash_receipts: true,
      // Reports - Limited
      view_reports: true,
      view_general_reports: true,
      // System
      view_help: true
    },
    viewer: {
      // Dashboard
      view_dashboard: true,
      // Products - View only
      view_products: true,
      view_product_list: true, view_product_details: true, view_product_categories: true, view_product_inventory: true,
      // Customers - View only
      view_customers: true,
      view_customer_list: true, view_customer_details: true,
      // Suppliers - View only
      view_suppliers: true,
      view_supplier_list: true, view_supplier_details: true,
      // Orders - View only
      view_orders: true,
      view_sales: true, view_sales_orders: true, view_purchase_orders: true,
      view_sales_invoices: true, view_purchase_invoices: true,
      view_import_purchase: true,
      // Inventory - View only
      view_inventory: true, view_warehouses: true,
      view_inventory_levels: true, view_low_stock_alerts: true,
      // Returns - View only
      view_returns: true, view_sale_returns: true, view_purchase_returns: true,
      view_return_requests: true, view_return_history: true,
      // Discounts - View only
      view_discounts: true,
      view_discount_list: true,
      // Reports - Read-only
      view_reports: true,
      view_pl_statements: true, view_balance_sheets: true,
      view_general_reports: true, view_backdate_report: true,
      view_customer_analytics: true, view_anomaly_detection: true,
      // Accounting - View only
      view_chart_of_accounts: true, view_journal_vouchers: true, view_accounting_summary: true,
      // System
      view_help: true
    },
    sales_person: {
      // Dashboard
      view_dashboard: true,
      // Master data - View
      view_products: true, view_product_list: true, view_product_details: true, view_product_categories: true,
      view_customers: true, create_customers: true, edit_customers: true,
      view_customer_list: true, view_customer_details: true,
      view_suppliers: true, view_supplier_list: true, view_supplier_details: true,
      // Sales workflow
      view_orders: true, create_orders: true, edit_orders: true,
      view_sales: true, view_sales_orders: true, view_sales_invoices: true,
      create_sales_orders: true, edit_sales_orders: true,
      confirm_sales_orders: true,
      create_sales_invoices: true, edit_sales_invoices: true,
      apply_last_prices: true,
      manage_sales: true,
      // Sale Returns
      view_returns: true, view_sale_returns: true, create_sale_returns: true, edit_sale_returns: true,
      // Purchase workflow
      view_purchase_orders: true, view_purchase_invoices: true,
      create_purchase_orders: true, edit_purchase_orders: true,
      create_purchase_invoices: true, edit_purchase_invoices: true,
      view_import_purchase: true, create_import_purchase: true, edit_import_purchase: true,
      // Purchase Returns
      view_purchase_returns: true, create_purchase_returns: true, edit_purchase_returns: true,
      // Inventory - read
      view_inventory: true, view_inventory_levels: true,
      // Discounts
      view_discounts: true, apply_discounts: true,
      // Reports
      view_reports: true, view_general_reports: true,
      // System
      view_help: true
    },
    employee: {
      // Dashboard
      view_dashboard: true,
      // Sales pages only
      view_sales: true,
      manage_sales: true,
      view_sales_orders: true,
      view_sales_invoices: true,
      create_sales_orders: true,
      create_sales_invoices: true,
      // Customers
      view_customers: true, view_customer_list: true, view_customer_details: true,
      // Products
      view_products: true, view_product_list: true, view_product_details: true,
      // System
      view_help: true
    },
    inventory: {
      view_products: true,
      view_product_list: true,
      view_product_details: true,
      view_product_categories: true,
      view_product_inventory: true,
      view_product_variants: true, create_product_variants: true, edit_product_variants: true,
      view_product_transformations: true, create_product_transformations: true, edit_product_transformations: true,
      view_inventory: true,
      create_inventory: true,
      edit_inventory: true,
      view_warehouses: true,
      create_warehouses: true,
      edit_warehouses: true,
      update_inventory: true,
      manage_inventory: true,
      view_inventory_levels: true,
      view_stock_movements: true,
      view_low_stock_alerts: true,
      update_stock_quantities: true,
      create_stock_adjustments: true,
      process_receipts: true,
      view_suppliers: true, view_supplier_list: true, view_supplier_details: true,
      view_market_prices: true,
      view_dashboard: true,
      view_help: true
    }
  };
