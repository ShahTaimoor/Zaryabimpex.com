import React from 'react';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Warehouse,
  BarChart3,
  CreditCard,
  Truck,
  Building,
  Building2,
  FileText,
  RotateCcw,
  Tag,
  TrendingUp,
  Receipt,
  ArrowUpDown,
  ArrowRightLeft,
  ArrowRight,
  FolderTree,
  Clock,
  MapPin,
  AlertTriangle,
  Wallet,
  Camera,
  ClipboardList,
} from 'lucide-react';
import { getRouteAccess } from './routeAccess';

function DatabaseIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

const withRouteAccess = (items) => {
  return items.map((item) => {
    const next = { ...item };

    if (item.href) {
      const access = getRouteAccess(item.href);
      if (access) {
        if (Object.prototype.hasOwnProperty.call(access, 'permission')) {
          next.permission = access.permission;
        }
        if (Object.prototype.hasOwnProperty.call(access, 'permissionAny')) {
          next.permissionAny = access.permissionAny;
        } else {
          delete next.permissionAny;
        }
        if (Object.prototype.hasOwnProperty.call(access, 'role')) {
          next.role = access.role;
        } else {
          delete next.role;
        }
      }
    }

    if (item.children?.length) {
      next.children = withRouteAccess(item.children);
    }

    return next;
  });
};

export const navigation = withRouteAccess([
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'view_dashboard', allowMultiple: false, sidebarDefaultHidden: true },

  {
    name: 'Sales',
    icon: ShoppingCart,
    permission: 'view_sales',
    children: [
      { name: 'Sales Orders', href: '/sales-orders', icon: FileText, permission: 'view_sales_orders' },
      { name: 'Sales', href: '/sales', icon: CreditCard, permission: 'view_sales' },
      { name: 'Sale Returns', href: '/sale-returns', icon: RotateCcw, permission: 'view_sale_returns' },
    ],
  },

  {
    name: 'Purchase',
    icon: Truck,
    permission: 'view_purchase_orders',
    children: [
      { name: 'Purchase Orders', href: '/purchase-orders', icon: FileText, permission: 'view_purchase_orders' },
      { name: 'Purchase', href: '/purchase', icon: Truck, permission: 'view_purchase_orders' },
      { name: 'Import Purchase', href: '/import-purchase', icon: Truck, permission: 'view_import_purchase' },
      { name: 'Current Purchase Market Prices', href: '/market-prices', icon: Tag, permissionAny: ['view_market_prices', 'create_market_prices', 'edit_market_prices', 'delete_market_prices', 'manage_market_prices', 'import_market_prices'] },
      { name: 'Purchase Returns', href: '/purchase-returns', icon: RotateCcw, permission: 'view_purchase_returns' },
    ],
  },

  {
    name: 'Financials',
    icon: Wallet,
    permissionAny: ['view_cash_receiving', 'view_cash_receipts', 'view_cash_payments', 'view_bank_receipts', 'view_bank_payments', 'view_expenses'],
    children: [
      { name: 'Multi Cash Receipt', href: '/cash-receiving', icon: Receipt, permission: 'view_cash_receiving' },
      { name: 'Cash Receipts', href: '/cash-receipts', icon: Receipt, permission: 'view_cash_receipts' },
      { name: 'Cash Payments', href: '/cash-payments', icon: CreditCard, permission: 'view_cash_payments' },
      { name: 'Bank Receipts', href: '/bank-receipts', icon: Building, permission: 'view_bank_receipts' },
      { name: 'Bank Payments', href: '/bank-payments', icon: ArrowUpDown, permission: 'view_bank_payments' },
      { name: 'Record Expense', href: '/expenses', icon: Wallet, permission: 'view_expenses' },
      { name: 'Daily Cash Closing', href: '/daily-cash', icon: Wallet, requiresFeature: 'dailyCashClosing', sidebarDefaultHidden: true },
    ],
  },

  {
    name: 'Master Data',
    icon: DatabaseIcon,
    children: [
      { name: 'Products', href: '/products', icon: Package, permission: 'view_products' },
      { name: 'Product Variants', href: '/product-variants', icon: Tag, permission: 'view_product_variants' },
      { name: 'Product Transformations', href: '/product-transformations', icon: ArrowRight, permission: 'view_product_transformations' },
      { name: 'Categories', href: '/categories', icon: Tag, permission: 'view_product_categories' },
      { name: 'Customers', href: '/customers', icon: Users, permission: 'view_customers' },
      { name: 'Customer Analytics', href: '/customer-analytics', icon: BarChart3, permission: 'view_customer_analytics' },
      { name: 'Suppliers', href: '/suppliers', icon: Building, permission: 'view_suppliers' },
      { name: 'Bank & cash opening', href: '/banks', icon: Building2, permission: 'view_banks' },
      { name: 'Investors', href: '/investors', icon: TrendingUp, permission: 'view_investors' },
      { name: 'Drop Shipping', href: '/drop-shipping', icon: ArrowRight, permission: 'view_drop_shipping' },
      { name: 'Cities', href: '/cities', icon: MapPin, permission: 'view_cities' },
      { name: 'Discounts', href: '/discounts', icon: Tag, permission: 'view_discounts' },
      { name: 'CCTV Access', href: '/cctv-access', icon: Camera, permission: 'view_cctv_access', allowMultiple: true },
    ],
  },

  {
    name: 'Inventory',
    icon: Warehouse,
    permission: 'view_inventory',
    children: [
      { name: 'Inventory', href: '/inventory', icon: Warehouse, permission: 'view_inventory' },
      { name: 'Inventory Alerts', href: '/inventory-alerts', icon: AlertTriangle, permission: 'view_inventory', allowMultiple: true },
      { name: 'Warehouses', href: '/warehouses', icon: Warehouse, permission: 'view_warehouses' },
      { name: 'Stock Movements', href: '/stock-movements', icon: ArrowUpDown, permission: 'view_stock_movements' },
      { name: 'Stock Transfers', href: '/stock-transfers', icon: ArrowRightLeft, permission: 'manage_inventory', sidebarDefaultHidden: true },
      { name: 'Stock Ledger', href: '/stock-ledger', icon: FileText, permission: 'view_inventory_levels' },
    ],
  },

  {
    name: 'Accounting',
    icon: ClipboardList,
    permissionAny: ['view_chart_of_accounts', 'view_journal_vouchers', 'view_accounting_summary'],
    children: [
      { name: 'Chart of Accounts', href: '/chart-of-accounts', icon: FolderTree, permission: 'view_chart_of_accounts' },
      { name: 'Journal Vouchers', href: '/journal-vouchers', icon: FileText, permission: 'view_journal_vouchers', allowMultiple: true },
      { name: 'Account Ledger Summary', href: '/account-ledger', icon: FileText, permission: 'view_accounting_summary', allowMultiple: true },
    ],
  },

  {
    name: 'Analytics',
    icon: BarChart3,
    permission: 'view_reports',
    children: [
      { name: 'P&L Statements', href: '/pl-statements', icon: BarChart3, permission: 'view_pl_statements' },
      { name: 'Balance Sheet', href: '/balance-sheet-statement', icon: FileText, permission: 'view_balance_sheets' },
      { name: 'Anomaly Detection', href: '/anomaly-detection', icon: AlertTriangle, permission: 'view_anomaly_detection' },
      { name: 'Reports', href: '/reports', icon: BarChart3, permission: 'view_general_reports' },
      { name: 'Backdate Report', href: '/backdate-report', icon: Clock, permission: 'view_backdate_report' },
    ],
  },

  {
    name: 'HR/Admin',
    icon: Users,
    children: [
      { name: 'Employees', href: '/employees', icon: Users, permission: 'manage_users', allowMultiple: true },
      { name: 'Attendance', href: '/attendance', icon: Clock, permission: 'view_own_attendance' },
    ],
  },
]);

const DEFAULT_SIDEBAR_HIDDEN = {
  Dashboard: false,
  'Product Variants': false,
  'Product Transformations': false,
  'Customer Analytics': false,
  Investors: false,
  'Drop Shipping': false,
  'Import Purchase': false,
  'CCTV Access': false,
  Warehouses: false,
  'Stock Movements': false,
  'Backdate Report': false,
  'Current Purchase Market Prices': false,
  'Stock Transfers': false,
  'Daily Cash Closing': false,
};

/** Migrate legacy parent-only sidebar keys to per-child keys (see Settings → Sidebar). */
export function migrateSidebarConfig(parsed) {
  if (!parsed || typeof parsed !== 'object') return {};
  const next = { ...parsed };
  navigation.forEach((n) => {
    if (n.children && n.children.length) {
      if (next[n.name] === false) {
        n.children.forEach((child) => {
          next[child.name] = false;
        });
      }
      delete next[n.name];
    }
  });
  return next;
}

export function loadSidebarConfig() {
  const saved = localStorage.getItem('sidebarConfig');
  if (!saved) return { ...DEFAULT_SIDEBAR_HIDDEN };
  try {
    const parsed = JSON.parse(saved);
    const migrated = migrateSidebarConfig(parsed);
    if (migrated['Current Purchase Market Prices'] === undefined) {
      if (migrated['Current Market Prices'] !== undefined) {
        migrated['Current Purchase Market Prices'] = migrated['Current Market Prices'];
      } else {
        migrated['Current Purchase Market Prices'] = false;
      }
    }
    if (migrated['Import Purchase'] === undefined) {
      migrated['Import Purchase'] = false;
    }
    if (migrated['Dashboard'] === undefined) {
      migrated['Dashboard'] = false;
    }
    if (migrated['Stock Transfers'] === undefined) {
      migrated['Stock Transfers'] = false;
    }
    if (migrated['Daily Cash Closing'] === undefined) {
      migrated['Daily Cash Closing'] = false;
    }
    delete migrated['Current Market Prices'];
    if (JSON.stringify(migrated) !== JSON.stringify(parsed)) {
      localStorage.setItem('sidebarConfig', JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return { ...DEFAULT_SIDEBAR_HIDDEN };
  }
}

export function isSidebarNavItemVisible(item, sidebarConfig, orderSettings = null) {
  if (!item?.name) return false;
  if (item.requiresFeature === 'dailyCashClosing') {
    if (orderSettings?.dailyCashClosingEnabled !== true) {
      return false;
    }
  }
  if (item.sidebarDefaultHidden && sidebarConfig?.[item.name] === undefined) {
    return false;
  }
  return sidebarConfig?.[item.name] !== false;
}

const DEFAULT_BOTTOM_NAV = [
  { name: 'Cash Receipts', href: '/cash-receipts', icon: 'Receipt' },
  { name: 'Bank Receipts', href: '/bank-receipts', icon: 'Receipt' },
  { name: 'Cash Payments', href: '/cash-payments', icon: 'CreditCard' },
  { name: 'Bank Payments', href: '/bank-payments', icon: 'CreditCard' },
];

export function loadBottomNavConfig() {
  const saved = localStorage.getItem('bottomNavConfig');
  if (!saved) return [...DEFAULT_BOTTOM_NAV];
  try {
    return JSON.parse(saved);
  } catch {
    return [...DEFAULT_BOTTOM_NAV];
  }
}

export const sidebarHeaderColors = {
  Dashboard: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  Sales: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  Purchase: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  Financials: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  'Master Data': { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  Inventory: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  Accounting: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  Analytics: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  'HR/Admin': { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
};

export const getHeaderColors = (name) =>
  sidebarHeaderColors[name] || { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' };

export const defaultOpenSections = ['Sales', 'Purchase'];

/** Flatten navigation tree to leaf items (href + metadata). */
export function flattenNavigation(items = navigation) {
  const leaves = [];
  const traverse = (list) => {
    list.forEach((item) => {
      if (item.href) leaves.push(item);
      if (item.children?.length) traverse(item.children);
    });
  };
  traverse(items);
  return leaves;
}
