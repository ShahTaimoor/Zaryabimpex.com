import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Warehouse,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  User,
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
  ArrowRight,
  RefreshCw,
  Search,
  Clock,
  Plus,
  ChevronRight,
  ChevronDown,
  Wallet,
  FolderTree,
  Camera,
  PieChart,
  ClipboardList
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ErrorBoundary from './ErrorBoundary';
import MobileNavigation from './MobileNavigation';
import { loadSidebarConfig } from './MultiTabLayout';
import { useResponsive } from './ResponsiveContainer';
import { WhatsAppFloat } from './WhatsAppFloat';
import { useGetCategoryTreeQuery } from '../store/services/categoriesApi';
import { adaptApiCategoryTreeForSidebar } from '../utils/categoryTree';
import { PERMISSIONS, hasPermission } from '../config/rbacConfig';

// Revised Navigation Structure
export const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },

  {
    name: 'Sales',
    icon: ShoppingCart,
    permissionAny: [
      PERMISSIONS.VIEW_SALES,
      PERMISSIONS.VIEW_SALES_ORDERS,
      PERMISSIONS.VIEW_SALES_INVOICES,
      PERMISSIONS.CREATE_SALES_ORDERS,
      PERMISSIONS.EDIT_SALES_ORDERS,
      PERMISSIONS.CREATE_SALES_INVOICES,
      PERMISSIONS.EDIT_SALES_INVOICES,
      PERMISSIONS.CREATE_ORDERS,
      PERMISSIONS.EDIT_ORDERS,
    ],
    children: [
      { name: 'Sales Orders', href: '/sales-orders', icon: FileText, permission: PERMISSIONS.VIEW_SALES_ORDERS },
      { name: 'Sales', href: '/sales', icon: CreditCard, permissionAny: [PERMISSIONS.VIEW_SALES, PERMISSIONS.CREATE_SALES_INVOICES, PERMISSIONS.EDIT_SALES_INVOICES] },
      { name: 'Sale Returns', href: '/sale-returns', icon: RotateCcw, permission: PERMISSIONS.VIEW_SALE_RETURNS },
    ]
  },

  {
    name: 'Purchase',
    icon: Truck,
    permissionAny: [
      PERMISSIONS.VIEW_PURCHASE_ORDERS,
      PERMISSIONS.VIEW_PURCHASE_INVOICES,
      PERMISSIONS.CREATE_PURCHASE_ORDERS,
      PERMISSIONS.EDIT_PURCHASE_ORDERS,
      PERMISSIONS.CREATE_PURCHASE_INVOICES,
      PERMISSIONS.EDIT_PURCHASE_INVOICES,
      PERMISSIONS.VIEW_IMPORT_PURCHASE,
      PERMISSIONS.VIEW_PURCHASE_RETURNS,
    ],
    children: [
      { name: 'Purchase Orders', href: '/purchase-orders', icon: FileText, permissionAny: [PERMISSIONS.VIEW_PURCHASE_ORDERS, PERMISSIONS.CREATE_PURCHASE_ORDERS, PERMISSIONS.EDIT_PURCHASE_ORDERS] },
      { name: 'Purchase', href: '/purchase', icon: Truck, permissionAny: [PERMISSIONS.VIEW_PURCHASE_INVOICES, PERMISSIONS.CREATE_PURCHASE_INVOICES, PERMISSIONS.EDIT_PURCHASE_INVOICES] },
      { name: 'Import Purchase', href: '/import-purchase', icon: Truck, permissionAny: [PERMISSIONS.VIEW_IMPORT_PURCHASE, PERMISSIONS.CREATE_IMPORT_PURCHASE, PERMISSIONS.EDIT_IMPORT_PURCHASE] },
      { name: 'Purchase Returns', href: '/purchase-returns', icon: RotateCcw, permission: PERMISSIONS.VIEW_PURCHASE_RETURNS },
    ]
  },

  {
    name: 'Financials',
    icon: Wallet,
    permissionAny: ['view_cash_receiving', PERMISSIONS.VIEW_CASH_RECEIPTS, PERMISSIONS.VIEW_CASH_PAYMENTS, PERMISSIONS.VIEW_BANK_RECEIPTS, PERMISSIONS.VIEW_BANK_PAYMENTS, PERMISSIONS.VIEW_EXPENSES],
    children: [
      { name: 'Cash Receipts', href: '/cash-receipts', icon: Receipt, permission: PERMISSIONS.VIEW_CASH_RECEIPTS },
      { name: 'Cash Payments', href: '/cash-payments', icon: CreditCard, permission: PERMISSIONS.VIEW_CASH_PAYMENTS },
      { name: 'Bank Receipts', href: '/bank-receipts', icon: Building, permission: PERMISSIONS.VIEW_BANK_RECEIPTS },
      { name: 'Bank Payments', href: '/bank-payments', icon: ArrowUpDown, permission: PERMISSIONS.VIEW_BANK_PAYMENTS },
      { name: 'Record Expense', href: '/expenses', icon: Wallet, permission: PERMISSIONS.VIEW_EXPENSES },
    ]
  },

  {
    name: 'Master Data',
    icon: DatabaseIcon,
    children: [
      { name: 'Products', href: '/products', icon: Package, permission: PERMISSIONS.VIEW_PRODUCTS },
      { name: 'Categories', href: '/categories', icon: Tag, permission: 'view_product_categories' },
      { name: 'Customers', href: '/customers', icon: Users, permission: 'view_customers' },
      { name: 'Suppliers', href: '/suppliers', icon: Building, permission: 'view_suppliers' },
      { name: 'Bank & cash opening', href: '/banks', icon: Building2, permission: PERMISSIONS.VIEW_BANKS },
      { name: 'Investors', href: '/investors', icon: TrendingUp, permission: 'view_investors' },
      { name: 'Drop Shipping', href: '/drop-shipping', icon: ArrowRight, permission: 'view_drop_shipping' },
      { name: 'Discounts', href: '/discounts', icon: Tag, permission: 'view_discounts' },
      { name: 'CCTV Access', href: '/cctv-access', icon: Camera, permission: PERMISSIONS.VIEW_CCTV_ACCESS },
    ]
  },

  {
    name: 'Inventory',
    icon: Warehouse,
    permission: PERMISSIONS.VIEW_INVENTORY,
    children: [
      { name: 'Inventory', href: '/inventory', icon: Warehouse, permission: PERMISSIONS.VIEW_INVENTORY },
      { name: 'Warehouses', href: '/warehouses', icon: Warehouse, permission: PERMISSIONS.VIEW_WAREHOUSES },
      { name: 'Stock Movements', href: '/stock-movements', icon: ArrowUpDown, permission: 'view_stock_movements' },
      { name: 'Stock Ledger', href: '/stock-ledger', icon: FileText, permission: 'view_inventory_levels' },
    ]
  },

  {
    name: 'Accounting',
    icon: ClipboardList,
    permissionAny: [PERMISSIONS.VIEW_CHART_OF_ACCOUNTS, PERMISSIONS.VIEW_JOURNAL_VOUCHERS, PERMISSIONS.VIEW_ACCOUNTING_SUMMARY],
    children: [
      { name: 'Chart of Accounts', href: '/chart-of-accounts', icon: FolderTree, permission: PERMISSIONS.VIEW_CHART_OF_ACCOUNTS },
      { name: 'Journal Vouchers', href: '/journal-vouchers', icon: FileText, permission: PERMISSIONS.VIEW_JOURNAL_VOUCHERS },
      { name: 'Account Ledger Summary', href: '/account-ledger', icon: FileText, permission: PERMISSIONS.VIEW_ACCOUNTING_SUMMARY },
    ]
  },

  {
    name: 'Analytics',
    icon: BarChart3,
    permissionAny: ['view_pl_statements', 'view_balance_sheets', 'view_sales_performance', 'view_inventory_reports', 'view_general_reports', PERMISSIONS.VIEW_BACKDATE_REPORT],
    children: [
      { name: 'P&L Statements', href: '/pl-statements', icon: BarChart3, permission: 'view_pl_statements' },
      { name: 'Balance Sheet', href: '/balance-sheet-statement', icon: FileText, permission: 'view_balance_sheets' },
      { name: 'Sales Performance', href: '/sales-performance', icon: TrendingUp, permission: 'view_sales_performance' },
      { name: 'Inventory Reports', href: '/inventory-reports', icon: Warehouse, permission: 'view_inventory_reports' },
      { name: 'Reports', href: '/reports', icon: BarChart3, permission: 'view_general_reports' },
      { name: 'Backdate Report', href: '/backdate-report', icon: Clock, permission: PERMISSIONS.VIEW_BACKDATE_REPORT },
    ]
  },

  {
    name: 'System',
    icon: Settings,
    children: [
      { name: 'Migration', href: '/migration', icon: RefreshCw, permission: PERMISSIONS.VIEW_MIGRATION },
    ]
  }
];

// Helper for Database icon since it wasn't imported
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
  )
}

// Sidebar header colors per section - Black and White theme
const sidebarHeaderColors = {
  Dashboard: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  Sales: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  Purchase: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  Financials: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  'Master Data': { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  Inventory: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  Accounting: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  Analytics: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
  System: { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' },
};
const getHeaderColors = (name) => sidebarHeaderColors[name] || { bg: 'bg-black', text: 'text-white', hover: 'hover:bg-gray-800' };
const defaultOpenSections = ['Sales', 'Purchase'];
const SidebarItem = ({ item, isActivePath, sidebarConfig, level = 0, categoryTree, categoriesLoading, refetchCategories, user }) => {
  const hasChildren = item.children && item.children.length > 0;
  const [isOpen, setIsOpen] = useState(hasChildren && defaultOpenSections.includes(item.name));

  // Auto-expand if child is active
  useEffect(() => {
    if (hasChildren) {
      const childActive = item.children.some(child => isActivePath(child.href));
      if (childActive) setIsOpen(true);
    }
  }, [item, isActivePath, hasChildren]);

  const canViewItem = (target) => {
    if (target.permissionAny?.length) {
      return target.permissionAny.some((permissionKey) => hasPermission(user, permissionKey));
    }
    if (target.permission) {
      return hasPermission(user, target.permission);
    }
    return true;
  };

  // Check visibility based on config
  if (sidebarConfig && sidebarConfig[item.name] === false) return null;

  // Check visibility based on RBAC permissions
  if (!canViewItem(item)) return null;

  // If group, check if any child is visible
  if (hasChildren) {
    const hasVisibleChild = item.children.some(child => {
      // Must pass both sidebarConfig and RBAC permission check
      const configVisible = sidebarConfig?.[child.name] !== false;
      const permissionVisible = canViewItem(child);
      return configVisible && permissionVisible;
    });
    if (!hasVisibleChild) return null;
  }

  const isActive = !hasChildren && isActivePath(item.href);

  return (
    <div className="mb-1">
      {hasChildren ? (
        <>
          {(() => {
            const colors = getHeaderColors(item.name);
            return (
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${isOpen ? `${colors.text || 'text-white'} ${colors.bg}` : `text-gray-600 hover:bg-gray-100 hover:text-gray-900`
                  }`}
              >
                <div className="flex items-center">
                  {item.icon && <item.icon className={`mr-3 h-4 w-4 ${isOpen ? 'text-white' : 'text-gray-400 group-hover:text-gray-500'}`} />}
                  <span>{item.name}</span>
                </div>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </button>
            );
          })()}
          {isOpen && (
            <div className="mt-1 ml-4 space-y-1 border-l-2 border-gray-100 pl-2">
              {item.children.map((child) => (
                <SidebarItem
                  key={child.name}
                  item={child}
                  isActivePath={isActivePath}
                  sidebarConfig={sidebarConfig}
                  level={level + 1}
                  categoryTree={categoryTree}
                  categoriesLoading={categoriesLoading}
                  refetchCategories={refetchCategories}
                  user={user}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="relative">
          <Link
            to={item.href}
            className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${isActive
                ? (level === 0 ? 'bg-black text-white' : 'bg-primary-50 text-primary-700')
                : (level === 0 ? 'text-gray-600 hover:bg-black hover:text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')
              }`}
          >
            {item.icon && <item.icon className={`mr-3 h-4 w-4 ${isActive ? (level === 0 ? 'text-white' : 'text-primary-500') : 'text-gray-400 group-hover:text-gray-500'}`} />}
            <span>{item.name}</span>
          </Link>

          {/* Special handling for Categories tree inside the menu */}
          {item.name === 'Categories' && (
            <div className="mt-1 ml-6">
              {categoriesLoading ? (
                <div className="px-2 py-1 text-xs text-gray-500 italic flex items-center">
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                  Loading...
                </div>
              ) : categoryTree && categoryTree.length > 0 ? (
                categoryTree.map((treeItem) => (
                  <CategoryTreeItem
                    key={treeItem.category._id}
                    category={treeItem.category}
                    subcategories={treeItem.subcategories}
                    isActive={false}
                  />
                ))
              ) : user ? (
                <div className="px-2 py-1 text-xs text-gray-500 italic flex items-center justify-between">
                  <span>No categories</span>
                  <button onClick={() => refetchCategories()} className="text-gray-400 hover:text-gray-600">
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Category Tree Component
const CategoryTreeItem = ({ category, subcategories, isActive, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = subcategories && subcategories.length > 0;

  return (
    <div className="my-1">
      <Link
        to={`/products?category=${category._id}`}
        className={`group flex items-center px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${isActive
          ? 'bg-primary-100 text-primary-900'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
          }`}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="mr-1 p-0.5 rounded hover:bg-gray-200"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-4 mr-1" />
        )}
        <span className="truncate">{category.name}</span>
      </Link>
      {hasChildren && isExpanded && (
        <div className="ml-2 border-l border-gray-100 pl-1">
          {subcategories.map((subcat) => (
            <CategoryTreeItem
              key={subcat.category._id}
              category={subcat.category}
              subcategories={subcat.subcategories}
              isActive={false}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isLoggingOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();

  // Sidebar visibility state (keys align with MultiTabLayout / Settings; migration in loadSidebarConfig)
  const [sidebarConfig, setSidebarConfig] = useState(() => loadSidebarConfig());
  const [showTopBar, setShowTopBar] = useState(() => {
    const saved = localStorage.getItem('showTopBarUI');
    return saved === null ? true : saved === 'true';
  });

  // Listener for sidebar configuration changes
  useEffect(() => {
    const handleSidebarChange = () => {
      setSidebarConfig(loadSidebarConfig());
    };
    const handleTopBarVisibilityChange = () => {
      const saved = localStorage.getItem('showTopBarUI');
      setShowTopBar(saved === null ? true : saved === 'true');
    };

    window.addEventListener('sidebarConfigChanged', handleSidebarChange);
    window.addEventListener('topBarVisibilityChanged', handleTopBarVisibilityChange);
    return () => {
      window.removeEventListener('sidebarConfigChanged', handleSidebarChange);
      window.removeEventListener('topBarVisibilityChanged', handleTopBarVisibilityChange);
    };
  }, []);

  const { data: categoryTreeRaw, isLoading: categoriesLoading, refetch: refetchCategories } = useGetCategoryTreeQuery(
    undefined,
    { skip: !user }
  );

  const categoryTree = React.useMemo(() => {
    const roots = Array.isArray(categoryTreeRaw) ? categoryTreeRaw : [];
    return adaptApiCategoryTreeForSidebar(roots);
  }, [categoryTreeRaw]);

  const handleLogout = async () => {
    await logout();
  };

  const isActivePath = (path) => location.pathname === path;

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Mobile Navigation */}
      <MobileNavigation user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-[60] lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-gray-100 shadow-xl">
          <div className="flex h-16 items-center justify-between px-4 bg-gray-100">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-black font-black text-white">Z</div>
              <h1 className="text-lg font-bold tracking-tight text-gray-900">ZARYAB IMPEX</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto max-h-[calc(100dvh-4rem)] scrollbar-thin scrollbar-thumb-gray-200">
            {navigation.map((item) => (
              <SidebarItem
                key={item.name}
                item={item}
                isActivePath={isActivePath}
                sidebarConfig={sidebarConfig}
                categoryTree={categoryTree}
                categoriesLoading={categoriesLoading}
                refetchCategories={refetchCategories}
                user={user}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-gray-100">
          <div className="flex h-16 items-center px-6 bg-gray-100">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-black font-black text-white">Z</div>
              <h1 className="text-lg font-bold tracking-tight text-gray-900">ZARYAB IMPEX</h1>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto max-h-[calc(100dvh-4rem)] scrollbar-thin scrollbar-thumb-gray-200">
            {navigation.map((item) => (
              <SidebarItem
                key={item.name}
                item={item}
                isActivePath={isActivePath}
                sidebarConfig={sidebarConfig}
                categoryTree={categoryTree}
                categoriesLoading={categoriesLoading}
                refetchCategories={refetchCategories}
                user={user}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        {showTopBar && (
          <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 bg-gray-100 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex flex-1 gap-x-2 sm:gap-x-4 self-stretch lg:gap-x-6 min-w-0 overflow-hidden">
            {/* Action Buttons - Shrink when zoom/screen percentage increases (responsive) */}
            <div className="hidden lg:flex items-center gap-1 xl:gap-1.5 2xl:gap-2 overflow-x-auto flex-1 min-w-0 scrollbar-hide overflow-y-visible">
              {sidebarConfig['Cash Receipts'] !== false && (
                <button
                  onClick={() => navigate('/cash-receipts')}
                  className="bg-white text-gray-900 border border-gray-200 hover:bg-black hover:text-white px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0 group/btn"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-gray-100 group-hover/btn:bg-gray-800 flex-shrink-0">
                    <Receipt className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-gray-900 group-hover/btn:text-white" />
                  </span>
                  <span className="hidden md:inline">Cash Receipts</span>
                </button>
              )}
              {sidebarConfig['Bank Receipts'] !== false && (
                <button
                  onClick={() => navigate('/bank-receipts')}
                  className="bg-white text-gray-900 border border-gray-200 hover:bg-black hover:text-white px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0 group/btn"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-gray-100 group-hover/btn:bg-gray-800 flex-shrink-0">
                    <Building className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-gray-900 group-hover/btn:text-white" />
                  </span>
                  <span className="hidden md:inline">Bank Receipts</span>
                </button>
              )}
              {sidebarConfig['Cash Payments'] !== false && (
                <button
                  onClick={() => navigate('/cash-payments')}
                  className="bg-white text-gray-900 border border-gray-200 hover:bg-black hover:text-white px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0 group/btn"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-gray-100 group-hover/btn:bg-gray-800 flex-shrink-0">
                    <CreditCard className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-gray-900 group-hover/btn:text-white" />
                  </span>
                  <span className="hidden md:inline">Cash Payments</span>
                </button>
              )}
              {sidebarConfig['Bank Payments'] !== false && (
                <button
                  onClick={() => navigate('/bank-payments')}
                  className="bg-white text-gray-900 border border-gray-200 hover:bg-black hover:text-white px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0 group/btn"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-gray-100 group-hover/btn:bg-gray-800 flex-shrink-0">
                    <ArrowUpDown className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-gray-900 group-hover/btn:text-white" />
                  </span>
                  <span className="hidden md:inline">Bank Payments</span>
                </button>
              )}
              {sidebarConfig['Record Expense'] !== false && (
                <button
                  onClick={() => navigate('/expenses')}
                  className="bg-white text-gray-900 border border-gray-200 hover:bg-black hover:text-white px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0 group/btn"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-gray-100 group-hover/btn:bg-gray-800 flex-shrink-0">
                    <Wallet className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-gray-900 group-hover/btn:text-white" />
                  </span>
                  <span className="hidden md:inline">Record Expense</span>
                </button>
              )}
            </div>
            <div className="flex flex-1 min-w-0"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* User menu */}
              <div className="flex items-center gap-x-2">
                <div className="flex items-center gap-x-2">
                  <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-600" />
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                    <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (isLoggingOut) return;
                    logout();
                  }}
                  disabled={isLoggingOut}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* Page content */}
        <main className={`${isMobile ? 'py-2' : 'py-4'} overflow-x-hidden max-w-full`}>
          <div className={`mx-auto max-w-full w-full overflow-x-hidden ${isMobile ? 'px-2' : 'px-2 sm:px-4 lg:px-6'}`}>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* WhatsApp Floating Button */}
      <WhatsAppFloat />
    </div>
  );
};

