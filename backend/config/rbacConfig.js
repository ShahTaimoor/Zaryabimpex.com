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
  
  // Products
  VIEW_PRODUCTS: 'view_products',
  CREATE_PRODUCTS: 'create_products',
  EDIT_PRODUCTS: 'edit_products',
  DELETE_PRODUCTS: 'delete_products',
  VIEW_PRODUCT_COSTS: 'view_product_costs', // Sensitive
  
  // Reports & Analytics
  VIEW_REPORTS: 'view_reports',
  VIEW_FINANCIAL_DATA: 'view_financial_data', // P&L, Balance Sheet
  
  // Settings & Admin
  MANAGE_USERS: 'manage_users',
  MANAGE_SETTINGS: 'manage_settings',
  
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
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.CREATE_PRODUCTS,
    PERMISSIONS.EDIT_PRODUCTS,
    PERMISSIONS.VIEW_PRODUCT_COSTS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.VIEW_REPORTS
  ],
  
  [ROLES.CASHIER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.MANAGE_SALES,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_INVENTORY
  ],
  
  [ROLES.EMPLOYEE]: [
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.MANAGE_SALES
    // Restricted: No dashboard, no reports, no product management, no cost prices
  ],
  
  [ROLES.INVENTORY]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY
  ],
  
  [ROLES.VIEWER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.VIEW_SALES
  ],

  [ROLES.SALES_PERSON]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_SALES_ORDERS
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
