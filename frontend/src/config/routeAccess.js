import { PERMISSIONS } from './rbacConfig';

export const ROUTE_ACCESS = {
  '/dashboard': { permission: PERMISSIONS.VIEW_DASHBOARD },
  '/sales-orders': { permissionAny: [PERMISSIONS.VIEW_SALES_ORDERS, PERMISSIONS.CREATE_SALES_ORDERS, PERMISSIONS.EDIT_SALES_ORDERS] },
  '/sales': { permissionAny: [PERMISSIONS.VIEW_SALES, PERMISSIONS.CREATE_SALES_INVOICES, PERMISSIONS.EDIT_SALES_INVOICES] },
  '/purchase-orders': { permissionAny: [PERMISSIONS.VIEW_PURCHASE_ORDERS, PERMISSIONS.CREATE_PURCHASE_ORDERS, PERMISSIONS.EDIT_PURCHASE_ORDERS] },
  '/purchase-invoices': { permissionAny: [PERMISSIONS.VIEW_PURCHASE_INVOICES, PERMISSIONS.CREATE_PURCHASE_INVOICES, PERMISSIONS.EDIT_PURCHASE_INVOICES] },
  '/market-prices': { permissionAny: [PERMISSIONS.VIEW_MARKET_PRICES, PERMISSIONS.CREATE_MARKET_PRICES, PERMISSIONS.EDIT_MARKET_PRICES, PERMISSIONS.DELETE_MARKET_PRICES, PERMISSIONS.MANAGE_MARKET_PRICES, PERMISSIONS.IMPORT_MARKET_PRICES] },
  '/purchase': { permissionAny: [PERMISSIONS.VIEW_PURCHASE_INVOICES, PERMISSIONS.CREATE_PURCHASE_INVOICES, PERMISSIONS.EDIT_PURCHASE_INVOICES] },
  '/import-purchase': { permissionAny: [PERMISSIONS.VIEW_IMPORT_PURCHASE, PERMISSIONS.CREATE_IMPORT_PURCHASE, PERMISSIONS.EDIT_IMPORT_PURCHASE] },
  '/products': { permission: PERMISSIONS.VIEW_PRODUCTS },
  '/product-variants': { permission: 'view_product_variants' },
  '/product-transformations': { permission: 'view_product_transformations' },
  '/categories': { permission: 'view_product_categories' },
  '/customers': { permission: 'view_customers' },
  '/suppliers': { permission: 'view_suppliers' },
  '/investors': { permission: 'view_investors' },
  '/drop-shipping': { permission: 'view_drop_shipping' },
  '/sales-invoices': { permissionAny: [PERMISSIONS.VIEW_SALES_INVOICES, PERMISSIONS.CREATE_SALES_INVOICES, PERMISSIONS.EDIT_SALES_INVOICES] },
  '/inventory': { permission: PERMISSIONS.VIEW_INVENTORY },
  '/inventory-alerts': { permission: 'view_low_stock_alerts' },
  '/customer-analytics': { permission: 'view_customer_analytics' },
  '/anomaly-detection': { permission: 'view_anomaly_detection' },
  '/warehouses': { permission: PERMISSIONS.VIEW_WAREHOUSES },
  '/stock-movements': { permission: 'view_stock_movements' },
  '/stock-transfers': { permission: PERMISSIONS.MANAGE_INVENTORY },
  '/stock-ledger': { permission: 'view_inventory_levels' },
  '/pl-statements': { permission: 'view_pl_statements' },
  '/balance-sheet-statement': { permission: 'view_balance_sheets' },
  '/sale-returns': { permissionAny: [PERMISSIONS.VIEW_SALE_RETURNS, PERMISSIONS.CREATE_SALE_RETURNS, PERMISSIONS.EDIT_SALE_RETURNS] },
  '/purchase-returns': { permissionAny: [PERMISSIONS.VIEW_PURCHASE_RETURNS, PERMISSIONS.CREATE_PURCHASE_RETURNS, PERMISSIONS.EDIT_PURCHASE_RETURNS] },
  '/discounts': { permission: 'view_discounts' },
  '/cash-receipts': { permissionAny: [PERMISSIONS.VIEW_CASH_RECEIPTS, 'create_cash_receipts', 'edit_cash_receipts'] },
  '/cash-receiving': { permissionAny: ['view_cash_receiving', 'create_cash_receiving', 'edit_cash_receiving'] },
  '/cash-payments': { permissionAny: [PERMISSIONS.VIEW_CASH_PAYMENTS, 'create_cash_payments', 'edit_cash_payments'] },
  '/cities': { permission: 'view_cities' },
  '/banks': { permission: PERMISSIONS.VIEW_BANKS },
  '/expenses': { permissionAny: [PERMISSIONS.VIEW_EXPENSES, 'create_expenses', 'edit_expenses'] },
  '/daily-cash': { role: 'admin' },
  '/till': { role: 'admin' },
  '/bank-receipts': { permissionAny: [PERMISSIONS.VIEW_BANK_RECEIPTS, 'create_bank_receipts', 'edit_bank_receipts'] },
  '/bank-payments': { permissionAny: [PERMISSIONS.VIEW_BANK_PAYMENTS, 'create_bank_payments', 'edit_bank_payments'] },
  '/journal-vouchers': { permission: PERMISSIONS.VIEW_JOURNAL_VOUCHERS },
  '/chart-of-accounts': { permission: PERMISSIONS.VIEW_CHART_OF_ACCOUNTS },
  '/account-ledger': { permission: PERMISSIONS.VIEW_ACCOUNTING_SUMMARY },
  '/reports': { permission: 'view_general_reports' },
  '/backdate-report': { permission: PERMISSIONS.VIEW_BACKDATE_REPORT },
  '/settings': { permissionAny: [PERMISSIONS.VIEW_SETTINGS, PERMISSIONS.EDIT_SETTINGS, PERMISSIONS.MANAGE_USERS] },
  '/settings2': { permissionAny: [PERMISSIONS.VIEW_SETTINGS, PERMISSIONS.EDIT_SETTINGS, PERMISSIONS.MANAGE_USERS] },
  '/migration': { permissionAny: [PERMISSIONS.VIEW_MIGRATION, PERMISSIONS.RUN_MIGRATION, PERMISSIONS.MANAGE_SETTINGS] },
  '/attendance': { permission: PERMISSIONS.VIEW_OWN_ATTENDANCE },
  '/employees': { permission: PERMISSIONS.MANAGE_USERS },
  '/cctv-access': { permission: PERMISSIONS.VIEW_CCTV_ACCESS },
  '/help': { permission: 'view_help' },
};

export const getRouteAccess = (path) => ROUTE_ACCESS[path] || null;

export const canAccessRoute = (path, user, hasPermission) => {
  const access = getRouteAccess(path);
  if (!access) return true;
  if (user?.role === 'admin') return true;
  if (access.role && user?.role !== access.role) return false;
  if (Array.isArray(access.permissionAny) && access.permissionAny.length > 0) {
    return access.permissionAny.some((permission) => hasPermission(permission));
  }
  if (!access.permission) return true;
  return hasPermission(access.permission);
};
