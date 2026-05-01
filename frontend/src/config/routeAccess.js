import { PERMISSIONS } from './rbacConfig';

export const ROUTE_ACCESS = {
  '/dashboard': { permission: PERMISSIONS.VIEW_DASHBOARD },
  '/sales-orders': { permissionAny: [PERMISSIONS.VIEW_SALES_ORDERS, PERMISSIONS.CREATE_SALES_ORDERS, PERMISSIONS.EDIT_SALES_ORDERS] },
  '/sales': { permissionAny: [PERMISSIONS.CREATE_ORDERS, PERMISSIONS.EDIT_ORDERS, PERMISSIONS.MANAGE_SALES] },
  '/purchase-orders': { permissionAny: [PERMISSIONS.VIEW_PURCHASE_ORDERS, PERMISSIONS.CREATE_PURCHASE_ORDERS, PERMISSIONS.EDIT_PURCHASE_ORDERS] },
  '/purchase-invoices': { permissionAny: [PERMISSIONS.VIEW_PURCHASE_INVOICES, PERMISSIONS.CREATE_PURCHASE_INVOICES, PERMISSIONS.EDIT_PURCHASE_INVOICES] },
  '/purchase': { permissionAny: [PERMISSIONS.CREATE_ORDERS, PERMISSIONS.EDIT_ORDERS] },
  '/products': { permission: PERMISSIONS.VIEW_PRODUCTS },
  '/product-variants': { permission: PERMISSIONS.VIEW_PRODUCTS },
  '/product-transformations': { permission: PERMISSIONS.VIEW_PRODUCTS },
  '/categories': { permission: PERMISSIONS.VIEW_PRODUCTS },
  '/customers': { permission: PERMISSIONS.VIEW_PRODUCTS },
  '/suppliers': { permission: PERMISSIONS.VIEW_PRODUCTS },
  '/investors': { permission: PERMISSIONS.VIEW_REPORTS },
  '/drop-shipping': { permission: PERMISSIONS.VIEW_SALES },
  '/sales-invoices': { permissionAny: [PERMISSIONS.VIEW_SALES_INVOICES, PERMISSIONS.CREATE_SALES_INVOICES, PERMISSIONS.EDIT_SALES_INVOICES] },
  '/inventory': { permission: PERMISSIONS.VIEW_INVENTORY },
  '/inventory-alerts': { permission: PERMISSIONS.VIEW_INVENTORY },
  '/customer-analytics': { permission: PERMISSIONS.VIEW_REPORTS },
  '/anomaly-detection': { permission: PERMISSIONS.VIEW_REPORTS },
  '/warehouses': { permission: PERMISSIONS.VIEW_INVENTORY },
  '/stock-movements': { permission: PERMISSIONS.VIEW_INVENTORY },
  '/pl-statements': { permission: PERMISSIONS.VIEW_FINANCIAL_DATA },
  '/balance-sheet-statement': { permission: PERMISSIONS.VIEW_FINANCIAL_DATA },
  '/sale-returns': { permission: PERMISSIONS.MANAGE_SALES },
  '/purchase-returns': { permission: PERMISSIONS.MANAGE_INVENTORY },
  '/purchase-by-supplier': { permission: PERMISSIONS.VIEW_REPORTS },
  '/discounts': { permission: PERMISSIONS.MANAGE_SETTINGS },
  '/sales-performance': { permission: PERMISSIONS.VIEW_REPORTS },
  '/inventory-reports': { permission: PERMISSIONS.VIEW_REPORTS },
  '/cash-receipts': { permissionAny: [PERMISSIONS.VIEW_CASH_RECEIPTS, 'create_cash_receipts', 'edit_cash_receipts'] },
  '/cash-receiving': { permissionAny: [PERMISSIONS.VIEW_CASH_RECEIPTS, 'create_cash_receipts', 'edit_cash_receipts'] },
  '/cash-payments': { permissionAny: [PERMISSIONS.VIEW_CASH_PAYMENTS, 'create_cash_payments', 'edit_cash_payments'] },
  '/cities': { permission: PERMISSIONS.MANAGE_SETTINGS },
  '/expenses': { permissionAny: [PERMISSIONS.VIEW_EXPENSES, 'create_expenses', 'edit_expenses'] },
  '/bank-receipts': { permissionAny: [PERMISSIONS.VIEW_BANK_RECEIPTS, 'create_bank_receipts', 'edit_bank_receipts'] },
  '/bank-payments': { permissionAny: [PERMISSIONS.VIEW_BANK_PAYMENTS, 'create_bank_payments', 'edit_bank_payments'] },
  '/journal-vouchers': { permission: PERMISSIONS.VIEW_ACCOUNTING_TRANSACTIONS },
  '/chart-of-accounts': { permission: PERMISSIONS.VIEW_CHART_OF_ACCOUNTS },
  '/account-ledger': { permission: PERMISSIONS.VIEW_ACCOUNTING_SUMMARY },
  '/reports': { permission: PERMISSIONS.VIEW_REPORTS },
  '/backdate-report': { permission: PERMISSIONS.VIEW_BACKDATE_REPORT },
  '/settings': { permission: PERMISSIONS.MANAGE_USERS },
  '/settings2': { permission: PERMISSIONS.MANAGE_USERS },
  '/migration': { permission: PERMISSIONS.MANAGE_SETTINGS },
  '/attendance': { permission: PERMISSIONS.VIEW_OWN_ATTENDANCE },
  '/employees': { permission: PERMISSIONS.MANAGE_USERS },
  '/cctv-access': { permission: PERMISSIONS.VIEW_SALES_INVOICES },
};

export const getRouteAccess = (path) => ROUTE_ACCESS[path] || null;

export const canAccessRoute = (path, user, hasPermission) => {
  const access = getRouteAccess(path);
  if (!access) return true;
  if (user?.role === 'admin') return true;
  if (Array.isArray(access.permissionAny) && access.permissionAny.length > 0) {
    return access.permissionAny.some((permission) => hasPermission(permission));
  }
  if (!access.permission) return true;
  return hasPermission(access.permission);
};
