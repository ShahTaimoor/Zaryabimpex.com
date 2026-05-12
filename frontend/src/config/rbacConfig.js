/**
 * RBAC Configuration for Frontend
 * Defines permissions for UI components and routes.
 */

export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'view_dashboard',

  // Sales
  VIEW_SALES: 'view_sales',
  MANAGE_SALES: 'manage_sales',
  VIEW_SALE_RETURNS: 'view_sale_returns',
  CREATE_SALE_RETURNS: 'create_sale_returns',
  EDIT_SALE_RETURNS: 'edit_sale_returns',
  DELETE_SALE_RETURNS: 'delete_sale_returns',
  VIEW_SALES_ORDERS: 'view_sales_orders',
  VIEW_SALES_INVOICES: 'view_sales_invoices',
  CREATE_SALES_ORDERS: 'create_sales_orders',
  EDIT_SALES_ORDERS: 'edit_sales_orders',
  CONFIRM_SALES_ORDERS: 'confirm_sales_orders',
  CANCEL_SALES_ORDERS: 'cancel_sales_orders',
  CREATE_SALES_INVOICES: 'create_sales_invoices',
  EDIT_SALES_INVOICES: 'edit_sales_invoices',
  CREATE_ORDERS: 'create_orders',
  EDIT_ORDERS: 'edit_orders',
  VIEW_PURCHASE_ORDERS: 'view_purchase_orders',
  VIEW_PURCHASE_INVOICES: 'view_purchase_invoices',
  CREATE_PURCHASE_ORDERS: 'create_purchase_orders',
  EDIT_PURCHASE_ORDERS: 'edit_purchase_orders',
  CREATE_PURCHASE_INVOICES: 'create_purchase_invoices',
  EDIT_PURCHASE_INVOICES: 'edit_purchase_invoices',
  VIEW_IMPORT_PURCHASE: 'view_import_purchase',
  CREATE_IMPORT_PURCHASE: 'create_import_purchase',
  EDIT_IMPORT_PURCHASE: 'edit_import_purchase',
  DELETE_IMPORT_PURCHASE: 'delete_import_purchase',
  VIEW_PURCHASE_RETURNS: 'view_purchase_returns',
  CREATE_PURCHASE_RETURNS: 'create_purchase_returns',
  EDIT_PURCHASE_RETURNS: 'edit_purchase_returns',
  DELETE_PURCHASE_RETURNS: 'delete_purchase_returns',
  
  // Products
  VIEW_PRODUCTS: 'view_products',
  CREATE_PRODUCTS: 'create_products',
  EDIT_PRODUCTS: 'edit_products',
  DELETE_PRODUCTS: 'delete_products',
  VIEW_PRODUCT_COSTS: 'view_product_costs',
  VIEW_BP: 'view_bp',
  APPLY_LAST_PRICES: 'apply_last_prices',
  VIEW_CUSTOMER_BALANCE: 'view_customer_balance',
  VIEW_SUPPLIER_BALANCE: 'view_supplier_balance',
  VIEW_STOCK_LEVELS: 'view_stock_levels',
  VIEW_CUSTOMER_PHONE: 'view_customer_phone',
  VIEW_SUPPLIER_PHONE: 'view_supplier_phone',
  VIEW_MARKET_PRICES: 'view_market_prices',
  MANAGE_MARKET_PRICES: 'manage_market_prices',
  IMPORT_MARKET_PRICES: 'import_market_prices',
  CREATE_MARKET_PRICES: 'create_market_prices',
  EDIT_MARKET_PRICES: 'edit_market_prices',
  DELETE_MARKET_PRICES: 'delete_market_prices',
  
  // Reports & Analytics
  VIEW_REPORTS: 'view_reports',
  VIEW_FINANCIAL_DATA: 'view_financial_data',
  
  // Settings & Admin
  MANAGE_USERS: 'manage_users',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_PRINT_SETTINGS: 'manage_print_settings',
  MANAGE_PRODUCT_SETTINGS: 'manage_product_settings',
  MANAGE_CUSTOMER_SETTINGS: 'manage_customer_settings',
  MANAGE_SUPPLIER_SETTINGS: 'manage_supplier_settings',
  MANAGE_ADVANCED_SETTINGS: 'manage_advanced_settings',

  // Settings sub-features (Print)
  SETTINGS_PRINT_LAYOUT: 'settings_print_layout',
  SETTINGS_PRINT_LOGO_HEADER: 'settings_print_logo_header',
  SETTINGS_PRINT_PARTY_DETAILS: 'settings_print_party_details',
  SETTINGS_PRINT_INVOICE_META: 'settings_print_invoice_meta',
  SETTINGS_PRINT_FINANCIALS: 'settings_print_financials',
  SETTINGS_PRINT_BEHAVIOR: 'settings_print_behavior',
  // Settings sub-features (Products)
  SETTINGS_PRODUCT_IMAGES: 'settings_product_images',
  SETTINGS_PRODUCT_FIELDS: 'settings_product_fields',
  // Settings sub-features (Customers)
  SETTINGS_CUSTOMER_FIELDS: 'settings_customer_fields',
  // Settings sub-features (Suppliers)
  SETTINGS_SUPPLIER_FIELDS: 'settings_supplier_fields',
  // Settings sub-features (Advanced)
  SETTINGS_ADVANCED_DISPLAY: 'settings_advanced_display',
  SETTINGS_ADVANCED_FEATURES: 'settings_advanced_features',
  SETTINGS_ADVANCED_SECURITY: 'settings_advanced_security',
  VIEW_SETTINGS: 'view_settings',
  EDIT_SETTINGS: 'edit_settings',
  VIEW_MIGRATION: 'view_migration',
  RUN_MIGRATION: 'run_migration',
  
  // Inventory
  VIEW_INVENTORY: 'view_inventory',
  MANAGE_INVENTORY: 'manage_inventory',
  
  // Accounting
  VIEW_ACCOUNTING: 'view_accounting',
  MANAGE_ACCOUNTING: 'manage_accounting',

  // Additional route/menu permissions
  VIEW_BACKDATE_REPORT: 'view_backdate_report',
  VIEW_OWN_ATTENDANCE: 'view_own_attendance',
  VIEW_TEAM_ATTENDANCE: 'view_team_attendance',
  VIEW_CHART_OF_ACCOUNTS: 'view_chart_of_accounts',
  VIEW_ACCOUNTING_TRANSACTIONS: 'view_accounting_transactions',
  VIEW_ACCOUNTING_SUMMARY: 'view_accounting_summary',
  VIEW_CASH_RECEIPTS: 'view_cash_receipts',
  VIEW_CASH_PAYMENTS: 'view_cash_payments',
  VIEW_BANK_RECEIPTS: 'view_bank_receipts',
  VIEW_BANK_PAYMENTS: 'view_bank_payments',
  VIEW_EXPENSES: 'view_expenses',
  VIEW_BANKS: 'view_banks',
  CREATE_BANKS: 'create_banks',
  EDIT_BANKS: 'edit_banks',
  DELETE_BANKS: 'delete_banks',
  VIEW_CCTV_ACCESS: 'view_cctv_access',
  VIEW_WAREHOUSES: 'view_warehouses',
  CREATE_WAREHOUSES: 'create_warehouses',
  EDIT_WAREHOUSES: 'edit_warehouses',
  DELETE_WAREHOUSES: 'delete_warehouses',
  VIEW_JOURNAL_VOUCHERS: 'view_journal_vouchers'
};

/**
 * Check if user has a specific permission
 * @param {Object} user - User object from auth context
 * @param {string} permission - Permission name
 * @returns {boolean}
 */
export const hasPermission = (user, permission) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  return user.permissions && user.permissions.includes(permission);
};
