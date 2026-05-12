/**
 * RBAC Configuration
 * Defines roles and their associated permissions.
 */

const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  EMPLOYEE: 'employee',
  INVENTORY: 'inventory',
  VIEWER: 'viewer',
  SALES_PERSON: 'sales_person'
};

const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'view_dashboard',

  // Sales
  VIEW_SALES: 'view_sales',
  MANAGE_SALES: 'manage_sales',
  VIEW_SALES_ORDERS: 'view_sales_orders',
  CONFIRM_SALES_ORDERS: 'confirm_sales_orders',
  CANCEL_SALES_ORDERS: 'cancel_sales_orders',
  
  // Products
  VIEW_PRODUCTS: 'view_products',
  CREATE_PRODUCTS: 'create_products',
  EDIT_PRODUCTS: 'edit_products',
  DELETE_PRODUCTS: 'delete_products',
  VIEW_PRODUCT_COSTS: 'view_product_costs', // Sensitive
  VIEW_CUSTOMER_BALANCE: 'view_customer_balance', // Sensitive
  VIEW_SUPPLIER_BALANCE: 'view_supplier_balance', // Sensitive
  VIEW_STOCK_LEVELS: 'view_stock_levels',
  VIEW_CUSTOMER_PHONE: 'view_customer_phone', // Sensitive
  VIEW_SUPPLIER_PHONE: 'view_supplier_phone', // Sensitive
  VIEW_MARKET_PRICES: 'view_market_prices',
  MANAGE_MARKET_PRICES: 'manage_market_prices',
  IMPORT_MARKET_PRICES: 'import_market_prices',
  
  // Reports & Analytics
  VIEW_REPORTS: 'view_reports',
  VIEW_FINANCIAL_DATA: 'view_financial_data', // P&L, Balance Sheet
  
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
  
  // Inventory
  VIEW_INVENTORY: 'view_inventory',
  MANAGE_INVENTORY: 'manage_inventory',
  
  // Accounting
  VIEW_ACCOUNTING: 'view_accounting',
  MANAGE_ACCOUNTING: 'manage_accounting'
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: ['*'], // Special wildcard for all permissions
  
  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.MANAGE_SALES,
    PERMISSIONS.VIEW_SALES_ORDERS,
    'view_sales_invoices',
    'create_sales_orders',
    'edit_sales_orders',
    'create_sales_invoices',
    'edit_sales_invoices',
    'view_sale_returns',
    'create_sale_returns',
    'edit_sale_returns',
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.CREATE_PRODUCTS,
    PERMISSIONS.EDIT_PRODUCTS,
    PERMISSIONS.VIEW_PRODUCT_COSTS,
    'view_bp',
    'apply_last_prices',
    PERMISSIONS.VIEW_CUSTOMER_BALANCE,
    PERMISSIONS.VIEW_SUPPLIER_BALANCE,
    PERMISSIONS.VIEW_STOCK_LEVELS,
    PERMISSIONS.VIEW_CUSTOMER_PHONE,
    PERMISSIONS.VIEW_SUPPLIER_PHONE,
    'view_product_categories',
    'view_customers',
    'view_suppliers',
    'view_banks',
    'view_cctv_access',
    PERMISSIONS.VIEW_MARKET_PRICES,
    PERMISSIONS.MANAGE_MARKET_PRICES,
    PERMISSIONS.IMPORT_MARKET_PRICES,
    'view_purchase_orders',
    'view_purchase_invoices',
    'create_purchase_orders',
    'edit_purchase_orders',
    'create_purchase_invoices',
    'edit_purchase_invoices',
    'view_import_purchase',
    'create_import_purchase',
    'edit_import_purchase',
    'view_purchase_returns',
    'create_purchase_returns',
    'edit_purchase_returns',
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY,
    'view_warehouses',
    'view_stock_movements',
    'view_inventory_levels',
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_PRINT_SETTINGS,
    PERMISSIONS.MANAGE_PRODUCT_SETTINGS,
    PERMISSIONS.MANAGE_CUSTOMER_SETTINGS,
    PERMISSIONS.MANAGE_SUPPLIER_SETTINGS,
    PERMISSIONS.MANAGE_ADVANCED_SETTINGS,
    PERMISSIONS.SETTINGS_PRINT_LAYOUT,
    PERMISSIONS.SETTINGS_PRINT_LOGO_HEADER,
    PERMISSIONS.SETTINGS_PRINT_PARTY_DETAILS,
    PERMISSIONS.SETTINGS_PRINT_INVOICE_META,
    PERMISSIONS.SETTINGS_PRINT_FINANCIALS,
    PERMISSIONS.SETTINGS_PRINT_BEHAVIOR,
    PERMISSIONS.SETTINGS_PRODUCT_IMAGES,
    PERMISSIONS.SETTINGS_PRODUCT_FIELDS,
    PERMISSIONS.SETTINGS_CUSTOMER_FIELDS,
    PERMISSIONS.SETTINGS_SUPPLIER_FIELDS,
    PERMISSIONS.SETTINGS_ADVANCED_DISPLAY,
    PERMISSIONS.SETTINGS_ADVANCED_FEATURES,
    PERMISSIONS.SETTINGS_ADVANCED_SECURITY,
    'view_help'
  ],
  
  [ROLES.CASHIER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.MANAGE_SALES,
    'view_sales_orders',
    'view_sales_invoices',
    'create_sales_orders',
    'edit_sales_orders',
    'create_sales_invoices',
    'edit_sales_invoices',
    'apply_last_prices',
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_INVENTORY,
    'view_inventory_levels',
    'view_help'
  ],
  
  [ROLES.EMPLOYEE]: [
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.MANAGE_SALES,
    'view_sales_orders',
    'view_sales_invoices',
    'view_help'
    // Restricted: No dashboard, no reports, no product management, no cost prices
  ],
  
  [ROLES.INVENTORY]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_MARKET_PRICES,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY,
    'view_warehouses',
    'view_stock_movements',
    'view_inventory_levels',
    'view_low_stock_alerts',
    'view_help'
  ],
  
  [ROLES.VIEWER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PRODUCTS,
    'view_product_categories',
    'view_customers',
    'view_suppliers',
    PERMISSIONS.VIEW_INVENTORY,
    'view_inventory_levels',
    PERMISSIONS.VIEW_SALES,
    'view_sales_orders',
    'view_sales_invoices',
    'view_help'
  ],

  [ROLES.SALES_PERSON]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.VIEW_SALES_ORDERS,
    'view_sales_invoices',
    'create_sales_orders',
    'edit_sales_orders',
    'create_sales_invoices',
    'edit_sales_invoices',
    'apply_last_prices',
    'view_purchase_orders',
    'view_purchase_invoices',
    'create_purchase_orders',
    'edit_purchase_orders',
    'create_purchase_invoices',
    'edit_purchase_invoices',
    'view_import_purchase',
    'view_help'
  ]
};

/**
 * Check if a role has a specific permission
 * @param {string} role - The user role
 * @param {string} permission - The permission to check
 * @returns {boolean}
 */
const hasPermission = (role, permission) => {
  if (!role) return false;
  
  const permissions = ROLE_PERMISSIONS[role.toLowerCase()] || [];
  
  if (permissions.includes('*')) return true;
  return permissions.includes(permission);
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission
};
