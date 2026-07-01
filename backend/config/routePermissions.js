/**
 * Reusable permission sets for API route guards (requireAnyPermission).
 * Keeps read-access rules consistent across routes.
 */
const { PERMISSIONS: P } = require('./rbacConfig');

const VIEW_PRODUCTS = [
  P.VIEW_PRODUCTS,
  P.MANAGE_SALES,
  P.VIEW_SALES,
  P.VIEW_INVENTORY,
  P.MANAGE_INVENTORY,
  'create_sales_invoices',
  'edit_sales_invoices',
  'create_sales_orders',
  'edit_sales_orders',
];

const VIEW_CUSTOMERS = [
  'view_customers',
  'view_accounting_summary',
  P.MANAGE_SALES,
  P.VIEW_SALES,
  'create_customers',
  'edit_customers',
];

const VIEW_SUPPLIERS = [
  'view_suppliers',
  'view_accounting_summary',
  'create_suppliers',
  'edit_suppliers',
  'view_purchase_orders',
  'view_purchase_invoices',
  'create_purchase_orders',
  'edit_purchase_orders',
];

const VIEW_SALES_ORDERS = [
  P.VIEW_SALES_ORDERS,
  P.MANAGE_SALES,
  P.VIEW_SALES,
  'create_sales_orders',
  'edit_sales_orders',
];

const VIEW_SALES = [
  P.VIEW_SALES,
  P.MANAGE_SALES,
  'view_sales_invoices',
  'create_sales_invoices',
  'edit_sales_invoices',
];

const VIEW_PURCHASE_INVOICES = [
  'view_purchase_invoices',
  'create_purchase_invoices',
  'edit_purchase_invoices',
  'view_purchase_orders',
];

const VIEW_PURCHASE_ORDERS = [
  'view_purchase_orders',
  'create_purchase_orders',
  'edit_purchase_orders',
];

const VIEW_SALE_RETURNS = [
  'view_sale_returns',
  'create_sale_returns',
  'edit_sale_returns',
];

const VIEW_PURCHASE_RETURNS = [
  'view_purchase_returns',
  'create_purchase_returns',
  'edit_purchase_returns',
];

const VIEW_DASHBOARD = [P.VIEW_DASHBOARD];

const VIEW_REPORTS = [P.VIEW_REPORTS, 'view_general_reports', 'view_pl_statements', 'view_balance_sheets'];

const VIEW_BACKDATE_REPORT = ['view_backdate_report', P.VIEW_REPORTS];

const VIEW_JOURNAL_VOUCHERS = [
  'view_journal_vouchers',
  'create_journal_vouchers',
  'edit_journal_vouchers',
  'delete_journal_vouchers',
];

const MANAGE_JOURNAL_VOUCHERS = [
  'create_journal_vouchers',
  'edit_journal_vouchers',
  'delete_journal_vouchers',
];

const VIEW_CHART_OF_ACCOUNTS = [
  'view_chart_of_accounts',
  'create_chart_of_accounts',
  'edit_chart_of_accounts',
  P.VIEW_ACCOUNTING,
];

const VIEW_ACCOUNTING_SUMMARY = [
  'view_accounting_summary',
  P.VIEW_ACCOUNTING,
  P.VIEW_REPORTS,
];

/** Account Ledger Summary page/API — strict; must not inherit view_reports alone */
const VIEW_ACCOUNT_LEDGER = [
  'view_accounting_summary',
];

const MANAGE_SETTINGS = [
  'manage_settings',
  'edit_settings',
  P.MANAGE_PRINT_SETTINGS,
  P.MANAGE_PRODUCT_SETTINGS,
  P.MANAGE_CUSTOMER_SETTINGS,
  P.MANAGE_SUPPLIER_SETTINGS,
  P.MANAGE_ADVANCED_SETTINGS,
];

const VIEW_SETTINGS = [
  'view_settings',
  'edit_settings',
  ...MANAGE_SETTINGS,
];

const VIEW_DROP_SHIPPING = [
  'view_drop_shipping',
  'create_drop_shipping',
  'edit_drop_shipping',
];

const MANAGE_MIGRATION = ['view_migration', 'run_migration', P.MANAGE_SETTINGS];

const VIEW_TEAM_ATTENDANCE = ['view_team_attendance', P.MANAGE_USERS];

const VIEW_DAILY_CASH = ['view_till', 'open_till', 'close_till'];

const EXPORT_DATA = [P.MANAGE_SETTINGS, 'view_reports', P.MANAGE_USERS];

module.exports = {
  VIEW_PRODUCTS,
  VIEW_CUSTOMERS,
  VIEW_SUPPLIERS,
  VIEW_SALES_ORDERS,
  VIEW_SALES,
  VIEW_PURCHASE_INVOICES,
  VIEW_PURCHASE_ORDERS,
  VIEW_SALE_RETURNS,
  VIEW_PURCHASE_RETURNS,
  VIEW_DASHBOARD,
  VIEW_REPORTS,
  VIEW_BACKDATE_REPORT,
  VIEW_JOURNAL_VOUCHERS,
  MANAGE_JOURNAL_VOUCHERS,
  VIEW_CHART_OF_ACCOUNTS,
  VIEW_ACCOUNTING_SUMMARY,
  VIEW_ACCOUNT_LEDGER,
  MANAGE_SETTINGS,
  VIEW_SETTINGS,
  VIEW_DROP_SHIPPING,
  MANAGE_MIGRATION,
  VIEW_TEAM_ATTENDANCE,
  VIEW_DAILY_CASH,
  EXPORT_DATA,
};
