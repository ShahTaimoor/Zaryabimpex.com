import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  ArrowDown,
  ArrowUp,
  ArrowRight,
  FolderTree,
  Search,
  Clock,
  MapPin,
  AlertTriangle,
  Wallet,
  ChevronRight,
  ChevronDown,
  Camera,
  Eye,
  EyeOff,
  Layers,
  PieChart,
  ClipboardList,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS } from '../config/rbacConfig';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../utils/componentUtils';
import TabBar from './TabBar';
import TabContent from './TabContent';
import { toast } from 'sonner';
import ErrorBoundary from './ErrorBoundary';
import MobileNavigation from './MobileNavigation';
import MobileBottomNav from './MobileBottomNav';
import { useResponsive } from './ResponsiveContainer';
import { useGetAlertSummaryQuery } from '../store/services/inventoryAlertsApi';
import { Button } from '@/components/ui/button';

// Helper for Database icon
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

export const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'view_dashboard', allowMultiple: true },

  {
    name: 'Sales',
    icon: ShoppingCart,
    permission: 'view_sales',
    children: [
      { name: 'Sales Orders', href: '/sales-orders', icon: FileText, permission: 'view_sales_orders' },
      { name: 'Sales', href: '/sales', icon: CreditCard, permission: 'manage_sales' },
      { name: 'Sales Invoices', href: '/sales-invoices', icon: Search, permission: 'view_sales_invoices' },
    ]
  },

  {
    name: 'Purchase',
    icon: Truck,
    permission: 'view_purchase_orders',
    children: [
      { name: 'Purchase Orders', href: '/purchase-orders', icon: FileText, permission: 'view_purchase_orders' },
      { name: 'Purchase', href: '/purchase', icon: Truck, permission: 'view_purchase_orders' },
      { name: 'Purchase Invoices', href: '/purchase-invoices', icon: Search, permission: 'view_purchase_invoices' },
      { name: 'Products by Supplier', href: '/purchase-by-supplier', icon: BarChart3, permission: 'view_reports' },
    ]
  },

  {
    name: 'Operations',
    icon: Layers,
    children: [
      { name: 'Sale Returns', href: '/sale-returns', icon: RotateCcw, permission: 'view_returns' },
      { name: 'Purchase Returns', href: '/purchase-returns', icon: RotateCcw, permission: 'view_returns' },
      { name: 'Discounts', href: '/discounts', icon: Tag, permission: 'view_discounts' },
      { name: 'CCTV Access', href: '/cctv-access', icon: Camera, permission: 'view_sales_invoices', allowMultiple: true },
    ]
  },

  {
    name: 'Financials',
    icon: Wallet,
    permission: 'view_reports',
    children: [
      { name: 'Cash Receipts', href: '/cash-receipts', icon: Receipt, permission: 'view_reports' },
      { name: 'Cash Payments', href: '/cash-payments', icon: CreditCard, permission: 'view_reports' },
      { name: 'Bank Receipts', href: '/bank-receipts', icon: Building, permission: 'view_reports' },
      { name: 'Bank Payments', href: '/bank-payments', icon: ArrowUpDown, permission: 'view_reports' },
      { name: 'Record Expense', href: '/expenses', icon: Wallet, permission: 'view_reports' },
    ]
  },

  {
    name: 'Master Data',
    icon: DatabaseIcon,
    children: [
      { name: 'Products', href: '/products', icon: Package, permission: 'view_products' },
      { name: 'Product Variants', href: '/product-variants', icon: Tag, permission: 'view_products' },
      { name: 'Product Transformations', href: '/product-transformations', icon: ArrowRight, permission: 'update_inventory' },
      { name: 'Categories', href: '/categories', icon: Tag, permission: 'view_products' },
      { name: 'Customers', href: '/customers', icon: Users, permission: 'view_customers' },
      { name: 'Customer Analytics', href: '/customer-analytics', icon: BarChart3, permission: 'view_customer_analytics' },
      { name: 'Suppliers', href: '/suppliers', icon: Building, permission: 'view_suppliers' },
      { name: 'Bank & cash opening', href: '/banks', icon: Building2, permission: 'manage_settings' },
      { name: 'Investors', href: '/investors', icon: TrendingUp, permission: 'view_investors' },
      { name: 'Drop Shipping', href: '/drop-shipping', icon: ArrowRight, permission: 'create_drop_shipping' },
      { name: 'Cities', href: '/cities', icon: MapPin, permission: 'manage_users' },
    ]
  },

  {
    name: 'Inventory',
    icon: Warehouse,
    permission: 'view_inventory',
    children: [
      { name: 'Inventory', href: '/inventory', icon: Warehouse, permission: 'view_inventory' },
      { name: 'Inventory Alerts', href: '/inventory-alerts', icon: AlertTriangle, permission: 'view_inventory', allowMultiple: true },
      { name: 'Warehouses', href: '/warehouses', icon: Warehouse, permission: 'view_inventory' },
      { name: 'Stock Movements', href: '/stock-movements', icon: ArrowUpDown, permission: 'view_stock_movements' },
      { name: 'Stock Ledger', href: '/stock-ledger', icon: FileText, permission: 'view_reports' },
    ]
  },

  {
    name: 'Accounting',
    icon: ClipboardList,
    permission: 'view_chart_of_accounts',
    children: [
      { name: 'Chart of Accounts', href: '/chart-of-accounts', icon: FolderTree, permission: 'view_chart_of_accounts' },
      { name: 'Journal Vouchers', href: '/journal-vouchers', icon: FileText, permission: 'view_reports', allowMultiple: true },
      { name: 'Account Ledger Summary', href: '/account-ledger', icon: FileText, permission: 'view_reports', allowMultiple: true },
    ]
  },

  {
    name: 'Analytics',
    icon: BarChart3,
    permission: 'view_reports',
    children: [
      { name: 'P&L Statements', href: '/pl-statements', icon: BarChart3, permission: 'view_pl_statements' },
      { name: 'Balance Sheet', href: '/balance-sheet-statement', icon: FileText, permission: 'view_balance_sheets' },
      { name: 'Sales Performance', href: '/sales-performance', icon: TrendingUp, permission: 'view_sales_performance' },
      { name: 'Inventory Reports', href: '/inventory-reports', icon: Warehouse, permission: 'view_inventory_reports' },
      { name: 'Anomaly Detection', href: '/anomaly-detection', icon: AlertTriangle, permission: 'view_anomaly_detection' },
      { name: 'Reports', href: '/reports', icon: BarChart3, permission: 'view_general_reports' },
      { name: 'Backdate Report', href: '/backdate-report', icon: Clock, permission: 'view_backdate_report' },
    ]
  },

  {
    name: 'HR/Admin',
    icon: Users,
    children: [
      { name: 'Employees', href: '/employees', icon: Users, permission: 'manage_users', allowMultiple: true },
      { name: 'Attendance', href: '/attendance', icon: Clock, permission: 'view_own_attendance' },
    ]
  },

  {
    name: 'System',
    icon: Settings,
    children: [
      { name: 'Settings', href: '/settings2', icon: Settings, permission: 'manage_users' },
      { name: 'Help', href: '/help', icon: HelpCircle, permission: null },
    ]
  }
];

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
  if (!saved) return {};
  try {
    const parsed = JSON.parse(saved);
    const migrated = migrateSidebarConfig(parsed);
    if (JSON.stringify(migrated) !== JSON.stringify(parsed)) {
      localStorage.setItem('sidebarConfig', JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return {};
  }
}

export function loadBottomNavConfig() {
  const saved = localStorage.getItem('bottomNavConfig');
  if (!saved) return [
    { name: 'Cash Receipts', href: '/cash-receipts', icon: 'Receipt' },
    { name: 'Bank Receipts', href: '/bank-receipts', icon: 'Receipt' },
    { name: 'Cash Payments', href: '/cash-payments', icon: 'CreditCard' },
    { name: 'Bank Payments', href: '/bank-payments', icon: 'CreditCard' }
  ];
  try {
    return JSON.parse(saved);
  } catch {
    return [
      { name: 'Cash Receipts', href: '/cash-receipts', icon: 'Receipt' },
      { name: 'Bank Receipts', href: '/bank-receipts', icon: 'Receipt' },
      { name: 'Cash Payments', href: '/cash-payments', icon: 'CreditCard' },
      { name: 'Bank Payments', href: '/bank-payments', icon: 'CreditCard' }
    ];
  }
}

// Sidebar header colors per section
const sidebarHeaderColors = {
  Sales: { bg: 'bg-emerald-50', hover: 'hover:bg-emerald-100', border: 'border-emerald-200' },
  Purchase: { bg: 'bg-amber-50', hover: 'hover:bg-amber-100', border: 'border-amber-200' },
  Operations: { bg: 'bg-violet-50', hover: 'hover:bg-violet-100', border: 'border-violet-200' },
  Financials: { bg: 'bg-sky-50', hover: 'hover:bg-sky-100', border: 'border-sky-200' },
  'Master Data': { bg: 'bg-teal-50', hover: 'hover:bg-teal-100', border: 'border-teal-200' },
  Inventory: { bg: 'bg-cyan-50', hover: 'hover:bg-cyan-100', border: 'border-cyan-200' },
  Accounting: { bg: 'bg-indigo-50', hover: 'hover:bg-indigo-100', border: 'border-indigo-200' },
  Analytics: { bg: 'bg-rose-50', hover: 'hover:bg-rose-100', border: 'border-rose-200' },
  'HR/Admin': { bg: 'bg-lime-50', hover: 'hover:bg-lime-100', border: 'border-lime-200' },
  System: { bg: 'bg-slate-50', hover: 'hover:bg-slate-100', border: 'border-slate-200' },
};
const getHeaderColors = (name) => sidebarHeaderColors[name] || { bg: 'bg-slate-50', hover: 'hover:bg-slate-100', border: 'border-slate-200' };
const defaultOpenSections = ['Sales', 'Purchase', 'Operations'];
const SidebarItem = ({ item, isActivePath, sidebarConfig, user, hasPermission, onNavigate, level = 0 }) => {
  const hasChildren = item.children && item.children.length > 0;
  const [isOpen, setIsOpen] = useState(hasChildren && defaultOpenSections.includes(item.name));

  // Auto-expand if child is active (must be before any early returns)
  useEffect(() => {
    if (hasChildren) {
      const childActive = item.children.some(child => isActivePath(child.href));
      if (childActive) setIsOpen(true);
    }
  }, [item, isActivePath, hasChildren]);

  // Check visibility and permission
  if (sidebarConfig && sidebarConfig[item.name] === false) return null;
  const isPermitted = !item.permission || user?.role === 'admin' || hasPermission(item.permission);
  if (!isPermitted) return null;

  // If group, check if any child is visible/permitted
  if (hasChildren) {
    const hasVisibleChild = item.children.some(child => {
      const childVisible = sidebarConfig?.[child.name] !== false;
      const childPermitted = !child.permission || user?.role === 'admin' || hasPermission(child.permission);
      return childVisible && childPermitted;
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
                className={`w-full group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${isOpen ? `text-gray-900 ${colors.bg}` : `text-gray-600 ${colors.bg} ${colors.hover} hover:text-gray-900`
                  }`}
              >
                <div className="flex items-center">
                  {item.icon && <item.icon className="mr-3 h-4 w-4 text-gray-400" />}
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
                  user={user}
                  hasPermission={hasPermission}
                  onNavigate={onNavigate}
                  level={level + 1}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <button
          onClick={() => onNavigate(item)}
          className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
        >
          {item.icon && <item.icon className={`mr-3 h-4 w-4 ${isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'}`} />}
          <span>{item.name}</span>
        </button>
      )}
    </div>
  );
};

// Inventory Alerts Badge Component - Always visible with professional design
const InventoryAlertsBadge = ({ onNavigate }) => {
  const { data: summaryData } = useGetAlertSummaryQuery(undefined, {
    pollingInterval: 60000, // Refetch every minute
    skip: false,
  });

  const summary = summaryData?.data || summaryData || {};
  const criticalCount = summary.critical || 0;
  const outOfStockCount = summary.outOfStock || 0;
  const totalAlerts = summary.total || 0;
  const displayCount = criticalCount > 0 ? criticalCount : (totalAlerts > 0 ? totalAlerts : 3);

  return (
    <button
      onClick={() => onNavigate({ href: '/inventory-alerts', name: 'Inventory Alerts' })}
      className="relative flex items-center justify-center px-2 py-2 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-900 transition-colors border border-gray-200 shadow-sm"
      title={`${criticalCount} critical alert(s), ${outOfStockCount} out of stock`}
    >
      <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
      {displayCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 min-w-[1.25rem]">
          {displayCount}
        </span>
      )}
    </button>
  );
};

export const MultiTabLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const { openTab, tabs, switchToTab, triggerTabHighlight, activeTabId } = useTab();

  // Dashboard visibility state
  const [dashboardHidden, setDashboardHidden] = useState(() => {
    const saved = localStorage.getItem('dashboardDataHidden');
    return saved === 'true';
  });

  const toggleDashboardVisibility = () => {
    const next = !dashboardHidden;
    setDashboardHidden(next);
    localStorage.setItem('dashboardDataHidden', String(next));
    // Trigger a custom event to notify Dashboard component
    window.dispatchEvent(new CustomEvent('dashboardVisibilityChanged', { detail: { hidden: next } }));
  };

  // Sidebar visibility state
  const [sidebarConfig, setSidebarConfig] = useState(() => loadSidebarConfig());

  // Listener for sidebar configuration changes
  useEffect(() => {
    const handleSidebarChange = () => {
      setSidebarConfig(loadSidebarConfig());
    };

    window.addEventListener('sidebarConfigChanged', handleSidebarChange);
    return () => window.removeEventListener('sidebarConfigChanged', handleSidebarChange);
  }, []);

  // Get alert summary for mobile bottom navbar
  const { data: summaryData } = useGetAlertSummaryQuery(undefined, {
    pollingInterval: 60000,
    skip: false,
  });
  const summary = summaryData?.data || summaryData || {};
  const criticalCount = summary.critical || 0;
  const totalAlerts = summary.total || 0;
  const displayCount = criticalCount > 0 ? criticalCount : (totalAlerts > 0 ? totalAlerts : 3);

  // Flatten grouped navigation for redirect logic
  const flattenedNavigation = React.useMemo(() => {
    const flat = [];
    const traverse = (items) => {
      items.forEach(item => {
        flat.push(item);
        if (item.children) {
          traverse(item.children);
        }
      });
    };
    traverse(navigation);
    return flat;
  }, []);

  // Redirect if current page is hidden
  useEffect(() => {
    // Only run if we have a user and navigation items loaded
    if (!user || flattenedNavigation.length === 0) return;

    const currentPath = location.pathname;

    // Don't redirect if we are on settings, login, or any other critical page
    if (currentPath === '/settings' || currentPath === '/settings2' || currentPath === '/login' || currentPath === '/profile') {
      return;
    }

    // Check if the current path is hidden in sidebarConfig
    // Note: This logic might need refinement for nested structure if we hide parent but want to show child, 
    // but usually if parent is hidden, children are hidden in UI. 
    // Here we check individual item config.
    const currentNavItem = flattenedNavigation.find(item => item.href === currentPath);

    if (currentNavItem && currentNavItem.name) {
      const isVisible = sidebarConfig[currentNavItem.name] !== false;
      const isPermitted = !currentNavItem.permission || user?.role === 'admin' || hasPermission(currentNavItem.permission);

      if (!isVisible || !isPermitted) {
        // Find the first visible and permitted page
        const firstVisiblePage = flattenedNavigation.find(item => {
          if (!item.href || !item.name) return false;
          if (item.children && item.children.length > 0) return false; // Skip groups
          const v = sidebarConfig[item.name] !== false;
          const p = !item.permission || user?.role === 'admin' || hasPermission(item.permission);
          return v && p;
        });

        if (firstVisiblePage && firstVisiblePage.href !== currentPath) {
          navigate(firstVisiblePage.href);
          toast.error(`"${currentNavItem.name}" is hidden. Redirecting to ${firstVisiblePage.name}.`, { id: 'nav-redirect' });
        }
      }
    }
  }, [location.pathname, sidebarConfig, flattenedNavigation, user, hasPermission, navigate]);


  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const reuseNavigationPaths = new Set([
    '/sales-invoices',
    '/sales-invoices/',
    '/orders',
    '/purchase-invoices',
    '/settings',
    '/settings2'
  ]);

  const handleNavigationClick = (item) => {
    const componentInfo = getComponentInfo(item.href);
    if (componentInfo) {
      const existingTab = tabs.find(tab => tab.path === item.href);

      // If allowMultiple is true, always open a new tab
      // If allowMultiple is false and tab exists, switch to existing tab (or reuse if in reuseNavigationPaths)
      if (!componentInfo.allowMultiple && existingTab) {
        if (reuseNavigationPaths.has(item.href)) {
          switchToTab(existingTab.id);
          triggerTabHighlight(existingTab.id);
          return;
        }
        // For non-reuse paths, still switch to existing tab if not allowMultiple
        switchToTab(existingTab.id);
        triggerTabHighlight(existingTab.id);
        return;
      }

      // Open new tab (either because allowMultiple is true, or no existing tab)
      const tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      openTab({
        title: componentInfo.title,
        path: item.href,
        component: componentInfo.component,
        icon: componentInfo.icon,
        allowMultiple: componentInfo.allowMultiple || false,
        props: { tabId: tabId }
      });
    } else {
      // For routes not in registry (like dashboard, settings), use regular navigation
      navigate(item.href);
    }
  };

  const isActivePath = (href) => {
    const normalizedPathname = location.pathname.replace(/\/$/, '') || '/';
    const normalizedHref = href.replace(/\/$/, '') || '/';
    const componentInfo = getComponentInfo(href);

    if (componentInfo) {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      const isActiveByTab = activeTab && activeTab.path === href;
      const isActiveByLocation = normalizedPathname === normalizedHref;
      return isActiveByTab || isActiveByLocation;
    }
    return normalizedPathname === normalizedHref;
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Navigation */}
      <MobileNavigation user={user} onLogout={handleLogout} />

      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-[60] lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900">POS System</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto max-h-[calc(100vh-4rem)] scrollbar-thin scrollbar-thumb-gray-200">
            {navigation.map((item) => (
              <SidebarItem
                key={item.name}
                item={item}
                isActivePath={isActivePath}
                sidebarConfig={sidebarConfig}
                user={user}
                hasPermission={hasPermission}
                onNavigate={(item) => {
                  handleNavigationClick(item);
                  setSidebarOpen(false);
                }}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-6 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900">POS System</h1>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto max-h-[calc(100vh-4rem)] scrollbar-thin scrollbar-thumb-gray-200">
            {navigation.map((item) => (
              <SidebarItem
                key={item.name}
                item={item}
                isActivePath={isActivePath}
                sidebarConfig={sidebarConfig}
                user={user}
                hasPermission={hasPermission}
                onNavigate={handleNavigationClick}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar - Professional Design with Solid White Background */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center border-b border-gray-200 bg-white px-3 sm:px-4 lg:px-6 shadow-sm overflow-visible">
          {/* Mobile Menu Button */}
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden mr-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Main Navigation Container */}
          <div className="flex flex-1 items-center gap-2 sm:gap-3 lg:gap-4 min-w-0">
            {/* Mobile Top Bar Buttons - Cash Receiving and Record Expense */}
            <div className="flex-shrink-0 lg:hidden flex items-center gap-2">
              {sidebarConfig['Cash Receipts'] !== false && (
                <button
                  onClick={() => handleNavigationClick({ href: '/cash-receipts', name: 'Cash Receipts' })}
                  className="bg-green-600 hover:bg-green-700 text-white px-2.5 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
                >
                  <Receipt className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Receiving</span>
                </button>
              )}
              {sidebarConfig['Record Expense'] !== false && (
                <button
                  onClick={() => handleNavigationClick({ href: '/expenses', name: 'Record Expense' })}
                  className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
                >
                  <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Expense</span>
                </button>
              )}
            </div>

            {/* Action Buttons - Shrink when zoom/screen percentage increases (responsive) */}
            <div className="hidden lg:flex items-center gap-1 xl:gap-1.5 2xl:gap-2 overflow-x-auto flex-1 min-w-0 scrollbar-hide overflow-y-visible">
              <button
                onClick={() => handleNavigationClick({ href: '/cash-receiving', name: 'Cash Receiving' })}
                className="bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-teal-200/60 flex-shrink-0">
                  <Receipt className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-teal-700" />
                </span>
                <span>Multiple Cash Receipt</span>
              </button>
              {sidebarConfig['Cash Receipts'] !== false && (
                <button
                  onClick={() => handleNavigationClick({ href: '/cash-receipts', name: 'Cash Receipts' })}
                  className="bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-green-200/60 flex-shrink-0">
                    <ArrowDown className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-green-700" />
                  </span>
                  <span className="hidden sm:inline">Cash Receipt</span>
                  <span className="sm:hidden">Cash R.</span>
                </button>
              )}
              {sidebarConfig['Bank Receipts'] !== false && (
                <button
                  onClick={() => handleNavigationClick({ href: '/bank-receipts', name: 'Bank Receipts' })}
                  className="bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-cyan-200/60 flex-shrink-0">
                    <ArrowDown className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-cyan-700" />
                  </span>
                  <span className="hidden sm:inline">Bank Receipt</span>
                  <span className="sm:hidden">Bank R.</span>
                </button>
              )}
              {sidebarConfig['Cash Payments'] !== false && (
                <button
                  onClick={() => handleNavigationClick({ href: '/cash-payments', name: 'Cash Payments' })}
                  className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-indigo-200/60 flex-shrink-0">
                    <ArrowUp className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-indigo-700" />
                  </span>
                  <span className="hidden sm:inline">Cash Payment</span>
                  <span className="sm:hidden">Cash P.</span>
                </button>
              )}
              {sidebarConfig['Bank Payments'] !== false && (
                <button
                  onClick={() => handleNavigationClick({ href: '/bank-payments', name: 'Bank Payments' })}
                  className="bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-violet-200/60 flex-shrink-0">
                    <ArrowUp className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-violet-700" />
                  </span>
                  <span className="hidden sm:inline">Bank Payment</span>
                  <span className="sm:hidden">Bank P.</span>
                </button>
              )}
              {sidebarConfig['Record Expense'] !== false && (
                <button
                  onClick={() => handleNavigationClick({ href: '/expenses', name: 'Record Expense' })}
                  className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-red-200/60 flex-shrink-0">
                    <Wallet className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-red-700" />
                  </span>
                  <span className="hidden sm:inline">Record Expense</span>
                  <span className="sm:hidden">Expense</span>
                </button>
              )}
            </div>


            {/* User Profile Section - Right Aligned with Dropdown */}
            <div className="relative flex items-center gap-2 sm:gap-3 ml-auto flex-shrink-0 overflow-visible" ref={userMenuRef}>
              {/* Alerts Button - Right side, left of Admin user */}
              {sidebarConfig['Inventory Alerts'] !== false && (
                <div className="flex-shrink-0">
                  <InventoryAlertsBadge onNavigate={handleNavigationClick} />
                </div>
              )}
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                title={`${user?.fullName} - ${user?.role}`}
              >
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{user?.fullName || 'User'}</p>
                  <p className="text-xs text-gray-500 capitalize leading-tight">{user?.role || 'Admin'}</p>
                </div>
                <ChevronRight className={`h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0 hidden sm:block transition-transform ${userMenuOpen ? 'rotate-90' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-md shadow-xl border border-gray-200 py-1 z-[60]">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-semibold text-gray-900">{user?.fullName || 'User'}</p>
                    {user?.email ? (
                      <p className="text-xs text-gray-500">{user.email}</p>
                    ) : (
                      <p className="text-xs text-gray-500 capitalize">{user?.role || 'Admin'}</p>
                    )}
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        handleNavigationClick({ href: '/settings2', name: 'Settings' });
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
                    >
                      <Settings className="h-4 w-4 flex-shrink-0" />
                      <span>Settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="h-4 w-4 flex-shrink-0" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <TabBar />

        {/* Page content */}
        <main className={`${isMobile ? 'py-2 pb-20' : 'py-4'} overflow-x-hidden max-w-full`}>
          <div className={`mx-auto max-w-full w-full overflow-x-hidden ${isMobile ? 'px-2' : 'px-2 sm:px-4 lg:px-6'}`}>
            <ErrorBoundary>
              {(() => {
                const pathname = location.pathname;
                const isFormPage = pathname === '/customers/new' ||
                  /^\/customers\/[^/]+\/edit$/.test(pathname);
                const showRoutes = tabs.length === 0 || isFormPage;
                return showRoutes ? children : <TabContent />;
              })()}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar - Dynamic based on configuration */}
      <MobileBottomNav />
    </div>
  );
};

