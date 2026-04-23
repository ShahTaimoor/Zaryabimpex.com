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
  VIEW_SALES_ORDERS: 'view_sales_orders',
  
  // Products
  VIEW_PRODUCTS: 'view_products',
  CREATE_PRODUCTS: 'create_products',
  EDIT_PRODUCTS: 'edit_products',
  DELETE_PRODUCTS: 'delete_products',
  VIEW_PRODUCT_COSTS: 'view_product_costs',
  
  // Reports & Analytics
  VIEW_REPORTS: 'view_reports',
  VIEW_FINANCIAL_DATA: 'view_financial_data',
  
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
