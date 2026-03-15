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
  EyeOff
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../utils/componentUtils';
import TabBar from './TabBar';
import TabContent from './TabContent';
import toast from 'react-hot-toast';
import ErrorBoundary from './ErrorBoundary';
import MobileNavigation from './MobileNavigation';
import { useResponsive } from './ResponsiveContainer';
import { useGetAlertSummaryQuery } from '../store/services/inventoryAlertsApi';

export const navigation = [
  // Dashboard
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: null, allowMultiple: true },

  // Sales Section
  { type: 'heading', name: 'Sales Section', color: 'bg-blue-500' },
  { name: 'Sales Orders', href: '/sales-orders', icon: FileText, permission: 'view_sales_orders' },
  { name: 'Sales', href: '/sales', icon: CreditCard, permission: 'view_sales_orders' },
  { name: 'Sales Invoices', href: '/sales-invoices', icon: Search, permission: 'view_sales_invoices' },

  // Purchase Section
  { type: 'heading', name: 'Purchase Section', color: 'bg-green-500' },
  { name: 'Purchase Orders', href: '/purchase-orders', icon: FileText, permission: 'view_purchase_orders' },
  { name: 'Purchase', href: '/purchase', icon: Truck, permission: 'view_purchase_orders' },
  { name: 'Purchase Invoices', href: '/purchase-invoices', icon: Search, permission: 'view_purchase_invoices' },

  // Operations Section
  { type: 'heading', name: 'Operations Section', color: 'bg-teal-500' },
  { name: 'Sale Returns', href: '/sale-returns', icon: RotateCcw, permission: 'view_returns' },
  { name: 'Purchase Returns', href: '/purchase-returns', icon: RotateCcw, permission: 'view_returns' },
  { name: 'Discounts', href: '/discounts', icon: Tag, permission: 'view_discounts' },
  { name: 'CCTV Access', href: '/cctv-access', icon: Camera, permission: 'view_sales_invoices', allowMultiple: true },

  // Financial Transactions Section
  { type: 'heading', name: 'Financial Transactions', color: 'bg-yellow-500' },
  { name: 'Cash Receipts', href: '/cash-receipts', icon: Receipt, permission: 'view_reports' },
  { name: 'Cash Payments', href: '/cash-payments', icon: CreditCard, permission: 'view_reports' },
  { name: 'Bank Receipts', href: '/bank-receipts', icon: Building, permission: 'view_reports' },
  { name: 'Bank Payments', href: '/bank-payments', icon: ArrowUpDown, permission: 'view_reports' },
  { name: 'Record Expense', href: '/expenses', icon: Wallet, permission: null },

  // Master Data Section
  { type: 'heading', name: 'Master Data Section', color: 'bg-purple-500' },
  { name: 'Products', href: '/products', icon: Package, permission: 'view_products' },
  { name: 'Product Variants', href: '/product-variants', icon: Tag, permission: 'view_products' },
  { name: 'Product Transformations', href: '/product-transformations', icon: ArrowRight, permission: 'update_inventory' },
  { name: 'Customers', href: '/customers', icon: Users, permission: 'view_customers' },
  { name: 'Customer Analytics', href: '/customer-analytics', icon: BarChart3, permission: 'view_customer_analytics' },
  { name: 'Suppliers', href: '/suppliers', icon: Building, permission: 'view_suppliers' },
  { name: 'Banks', href: '/banks', icon: Building2, permission: null },
  { name: 'Investors', href: '/investors', icon: TrendingUp, permission: 'view_investors' },
  { name: 'Drop Shipping', href: '/drop-shipping', icon: ArrowRight, permission: 'create_drop_shipping' },
  { name: 'Cities', href: '/cities', icon: MapPin, permission: 'manage_users' },

  // Inventory Section
  { type: 'heading', name: 'Inventory Section', color: 'bg-orange-500' },
  { name: 'Inventory', href: '/inventory', icon: Warehouse, permission: 'view_inventory' },
  { name: 'Inventory Alerts', href: '/inventory-alerts', icon: AlertTriangle, permission: 'view_inventory' },
  { name: 'Warehouses', href: '/warehouses', icon: Warehouse, permission: 'view_inventory' },
  { name: 'Stock Movements', href: '/stock-movements', icon: ArrowUpDown, permission: 'view_stock_movements' },
  { name: 'Stock Ledger', href: '/stock-ledger', icon: FileText, permission: 'view_reports' },

  // Accounting Section
  { type: 'heading', name: 'Accounting Section', color: 'bg-pink-500' },
  { name: 'Chart of Accounts', href: '/chart-of-accounts', icon: FolderTree, permission: 'view_chart_of_accounts' },
  { name: 'Journal Vouchers', href: '/journal-vouchers', icon: FileText, permission: 'view_reports', allowMultiple: true },
  { name: 'Account Ledger Summary', href: '/account-ledger', icon: FileText, permission: 'view_reports', allowMultiple: true },

  // Reports & Analytics Section
  { type: 'heading', name: 'Reports & Analytics', color: 'bg-indigo-500' },
  { name: 'P&L Statements', href: '/pl-statements', icon: BarChart3, permission: 'view_pl_statements' },
  { name: 'Balance Sheets', href: '/balance-sheets', icon: FileText, permission: 'view_balance_sheets' },
  { name: 'Sales Performance', href: '/sales-performance', icon: TrendingUp, permission: 'view_sales_performance' },
  { name: 'Inventory Reports', href: '/inventory-reports', icon: Warehouse, permission: 'view_inventory_reports' },
  { name: 'Anomaly Detection', href: '/anomaly-detection', icon: AlertTriangle, permission: 'view_anomaly_detection' },
  { name: 'Reports', href: '/reports', icon: BarChart3, permission: 'view_general_reports' },
  { name: 'Backdate Report', href: '/backdate-report', icon: Clock, permission: 'view_backdate_report' },

  // HR/Admin Section
  { type: 'heading', name: 'HR/Admin Section', color: 'bg-cyan-500' },
  { name: 'Employees', href: '/employees', icon: Users, permission: 'manage_users', allowMultiple: true },
  { name: 'Attendance', href: '/attendance', icon: Clock, permission: 'view_own_attendance' },

  // System/Utilities Section
  { type: 'heading', name: 'System/Utilities', color: 'bg-red-500' },
  { name: 'Settings', href: '/settings2', icon: Settings, permission: 'manage_users' },
];

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
  const [sidebarConfig, setSidebarConfig] = useState(() => {
    const saved = localStorage.getItem('sidebarConfig');
    return saved ? JSON.parse(saved) : {};
  });

  // Sidebar section expansion state - keep Sales, Purchase, and Operations open by default
  const [expandedSections, setExpandedSections] = useState(() => {
    const saved = localStorage.getItem('sidebarExpandedSections');
    if (saved) {
      return JSON.parse(saved);
    }
    // Default: Sales Section, Purchase Section, Operations Section are open
    return {
      'Sales Section': true,
      'Purchase Section': true,
      'Operations Section': true,
      'Financial Transactions': false,
      'Master Data Section': false,
      'Inventory Section': false,
      'Accounting Section': false,
      'Reports & Analytics': false,
      'HR/Admin Section': false,
      'System/Utilities': false
    };
  });

  // Save expanded sections to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarExpandedSections', JSON.stringify(expandedSections));
  }, [expandedSections]);

  const toggleSection = (sectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  // Listener for sidebar configuration changes
  useEffect(() => {
    const handleSidebarChange = () => {
      const saved = localStorage.getItem('sidebarConfig');
      if (saved) {
        setSidebarConfig(JSON.parse(saved));
      }
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

  // Group navigation by headings for collapsible sections
  const groupedNavigation = React.useMemo(() => {
    const groups = [];
    let currentGroup = null;

    navigation.forEach((item, index) => {
      if (item.type === 'heading') {
        // Start a new group
        const subItems = [];
        for (let i = index + 1; i < navigation.length; i++) {
          if (navigation[i].type === 'heading') break;
          if (navigation[i].name) {
            const isVisible = sidebarConfig[navigation[i].name] !== false;
            const isPermitted = !navigation[i].permission || user?.role === 'admin' || hasPermission(navigation[i].permission);
            if (isVisible && isPermitted) {
              subItems.push(navigation[i]);
            }
          }
        }

        // Only add group if it has visible items
        if (subItems.length > 0) {
          currentGroup = {
            heading: item,
            items: subItems
          };
          groups.push(currentGroup);
        } else {
          currentGroup = null;
        }
      } else if (item.name && !currentGroup) {
        // Items before first heading (like Dashboard)
        const isVisible = sidebarConfig[item.name] !== false;
        const isPermitted = !item.permission || user?.role === 'admin' || hasPermission(item.permission);
        if (isVisible && isPermitted) {
          groups.push({ heading: null, items: [item] });
        }
      }
    });

    return groups;
  }, [sidebarConfig, user, hasPermission]);

  // Flatten grouped navigation for redirect logic
  const flattenedNavigation = React.useMemo(() => {
    const flat = [];
    groupedNavigation.forEach(group => {
      group.items.forEach(item => {
        flat.push(item);
      });
    });
    return flat;
  }, [groupedNavigation]);

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
    const currentNavItem = navigation.find(item => item.href === currentPath);

    // If the item exists in navigation but is NOT in flattenedNavigation, it means it's hidden or restricted
    if (currentNavItem && currentNavItem.name) {
      const isVisible = sidebarConfig[currentNavItem.name] !== false;
      const isPermitted = !currentNavItem.permission || user?.role === 'admin' || hasPermission(currentNavItem.permission);

      if (!isVisible || !isPermitted) {
        // Find the first visible and permitted page (non-heading, non-divider)
        const firstVisiblePage = flattenedNavigation.find(item => item.href && item.name);

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
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4">
            <h1 className="text-xl font-bold text-gray-900">POS System</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto max-h-[calc(100vh-4rem)] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {groupedNavigation.map((group, groupIndex) => (
              <div key={`group-${groupIndex}`}>
                {/* Render items without heading (like Dashboard) */}
                {!group.heading && group.items.map((item) => {
                  const normalizedPathname = location.pathname.replace(/\/$/, '') || '/';
                  const normalizedHref = item.href.replace(/\/$/, '') || '/';
                  const componentInfo = getComponentInfo(item.href);
                  let isActive;
                  if (componentInfo) {
                    const activeTab = tabs.find(tab => tab.id === activeTabId);
                    const isActiveByTab = activeTab && activeTab.path === item.href;
                    const isActiveByLocation = normalizedPathname === normalizedHref;
                    isActive = isActiveByTab || isActiveByLocation;
                  } else {
                    isActive = normalizedPathname === normalizedHref;
                  }

                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        handleNavigationClick(item);
                        setSidebarOpen(false);
                      }}
                      className={`group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md ${isActive
                        ? 'bg-primary-100 text-primary-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </button>
                  );
                })}

                {/* Render heading with collapsible functionality */}
                {group.heading && (
                  <>
                    <button
                      onClick={() => toggleSection(group.heading.name)}
                      className={`w-full ${group.heading.color} text-white px-3 py-2 mt-3 mb-1 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm flex items-center justify-between hover:opacity-90 transition-opacity cursor-pointer`}
                    >
                      <span>{group.heading.name}</span>
                      {expandedSections[group.heading.name] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {/* Render items if section is expanded */}
                    {expandedSections[group.heading.name] && group.items.map((item) => {
                      const normalizedPathname = location.pathname.replace(/\/$/, '') || '/';
                      const normalizedHref = item.href.replace(/\/$/, '') || '/';
                      const componentInfo = getComponentInfo(item.href);
                      let isActive;
                      if (componentInfo) {
                        const activeTab = tabs.find(tab => tab.id === activeTabId);
                        const isActiveByTab = activeTab && activeTab.path === item.href;
                        const isActiveByLocation = normalizedPathname === normalizedHref;
                        isActive = isActiveByTab || isActiveByLocation;
                      } else {
                        isActive = normalizedPathname === normalizedHref;
                      }

                      return (
                        <button
                          key={item.name}
                          onClick={() => {
                            handleNavigationClick(item);
                            setSidebarOpen(false);
                          }}
                          className={`group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md ${isActive
                            ? 'bg-primary-100 text-primary-900'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                        >
                          <item.icon className="mr-3 h-5 w-5" />
                          {item.name}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-4">
            <h1 className="text-xl font-bold text-gray-900">POS System</h1>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto max-h-[calc(100vh-4rem)] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {groupedNavigation.map((group, groupIndex) => (
              <div key={`group-${groupIndex}`}>
                {/* Render items without heading (like Dashboard) */}
                {!group.heading && group.items.map((item) => {
                  const normalizedPathname = location.pathname.replace(/\/$/, '') || '/';
                  const normalizedHref = item.href.replace(/\/$/, '') || '/';
                  const componentInfo = getComponentInfo(item.href);
                  let isActive;
                  if (componentInfo) {
                    const activeTab = tabs.find(tab => tab.id === activeTabId);
                    const isActiveByTab = activeTab && activeTab.path === item.href;
                    const isActiveByLocation = normalizedPathname === normalizedHref;
                    isActive = isActiveByTab || isActiveByLocation;
                  } else {
                    isActive = normalizedPathname === normalizedHref;
                  }

                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavigationClick(item)}
                      className={`group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md ${isActive
                        ? 'bg-primary-100 text-primary-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </button>
                  );
                })}

                {/* Render heading with collapsible functionality */}
                {group.heading && (
                  <>
                    <button
                      onClick={() => toggleSection(group.heading.name)}
                      className={`w-full ${group.heading.color} text-white px-3 py-2 mt-3 mb-1 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm flex items-center justify-between hover:opacity-90 transition-opacity cursor-pointer`}
                    >
                      <span>{group.heading.name}</span>
                      {expandedSections[group.heading.name] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {/* Render items if section is expanded */}
                    {expandedSections[group.heading.name] && group.items.map((item) => {
                      const normalizedPathname = location.pathname.replace(/\/$/, '') || '/';
                      const normalizedHref = item.href.replace(/\/$/, '') || '/';
                      const componentInfo = getComponentInfo(item.href);
                      let isActive;
                      if (componentInfo) {
                        const activeTab = tabs.find(tab => tab.id === activeTabId);
                        const isActiveByTab = activeTab && activeTab.path === item.href;
                        const isActiveByLocation = normalizedPathname === normalizedHref;
                        isActive = isActiveByTab || isActiveByLocation;
                      } else {
                        isActive = normalizedPathname === normalizedHref;
                      }

                      return (
                        <button
                          key={item.name}
                          onClick={() => handleNavigationClick(item)}
                          className={`group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md ${isActive
                            ? 'bg-primary-100 text-primary-900'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                        >
                          <item.icon className="mr-3 h-5 w-5" />
                          {item.name}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
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

            {/* Action Buttons Container - Center/Mid-Left with Horizontal Scroll - Hidden on Mobile */}
            <div className="hidden lg:flex items-center gap-1.5 sm:gap-2 overflow-x-auto flex-1 min-w-0 scrollbar-hide overflow-y-visible">
              {/* Cash Receiving Button - Left side, desktop only */}
              <button
                onClick={() => navigate('/cash-receiving')}
                className="btn btn-primary items-center justify-center gap-1.5 px-2.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex text-xs sm:text-sm font-medium flex-shrink-0 whitespace-nowrap"
              >
                <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Cash Receiving</span>
              </button>
              
              {/* Green Buttons - Receipt related */}
              {sidebarConfig['Cash Receipts'] !== false && (
                <button
                  onClick={() => handleNavigationClick({ href: '/cash-receipts', name: 'Cash Receipts' })}
                  className="bg-green-500 hover:bg-green-600 text-white px-2.5 sm:px-3 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-1.5 text-xs sm:text-sm font-medium flex-shrink-0 whitespace-nowrap"
                >
                  <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Cash Receipt</span>
                  <span className="sm:hidden">Cash R.</span>
                </button>
              )}
              {sidebarConfig['Bank Receipts'] !== false && (
                <button
                  onClick={() => handleNavigationClick({ href: '/bank-receipts', name: 'Bank Receipts' })}
                  className="bg-green-500 hover:bg-green-600 text-white px-2.5 sm:px-3 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-1.5 text-xs sm:text-sm font-medium flex-shrink-0 whitespace-nowrap"
                >
                  <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Bank Receipt</span>
                  <span className="sm:hidden">Bank R.</span>
                </button>
              )}

              {/* Blue Buttons - Payment related */}
              {sidebarConfig['Cash Payments'] !== false && (
                <button
                  onClick={() => handleNavigationClick({ href: '/cash-payments', name: 'Cash Payments' })}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-2.5 sm:px-3 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-1.5 text-xs sm:text-sm font-medium flex-shrink-0 whitespace-nowrap"
                >
                  <ArrowUpDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Cash Payment</span>
                  <span className="sm:hidden">Cash P.</span>
                </button>
              )}
              {sidebarConfig['Bank Payments'] !== false && (
                <button
                  onClick={() => handleNavigationClick({ href: '/bank-payments', name: 'Bank Payments' })}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-2.5 sm:px-3 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-1.5 text-xs sm:text-sm font-medium flex-shrink-0 whitespace-nowrap"
                >
                  <ArrowUpDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Bank Payment</span>
                  <span className="sm:hidden">Bank P.</span>
                </button>
              )}

              {/* Record Expense Button - Right side next to Bank Payment */}
              {sidebarConfig['Record Expense'] !== false && (
                <button
                  onClick={() => handleNavigationClick({ href: '/expenses', name: 'Record Expense' })}
                  className="bg-red-500 hover:bg-red-600 text-white px-2.5 sm:px-3 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-1.5 text-xs sm:text-sm font-medium flex-shrink-0 whitespace-nowrap"
                >
                  <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
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
              {tabs.length > 0 ? (
                <TabContent />
              ) : (
                children
              )}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar - Without Alerts, Receiving, and Record Expense (they stay in top bar) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex items-center justify-center gap-1 px-1 py-1.5 overflow-x-auto scrollbar-hide">
          {/* Green Buttons - Receipt related */}
          {sidebarConfig['Cash Receipts'] !== false && (
            <button
              onClick={() => handleNavigationClick({ href: '/cash-receipts', name: 'Cash Receipts' })}
              className="flex flex-col items-center justify-center px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded-md shadow-sm transition-all duration-200 flex-1 max-w-[80px] flex-shrink-0"
              title="Cash Receipt"
            >
              <span className="text-[10px] font-medium whitespace-nowrap leading-tight">Cash R.</span>
            </button>
          )}
          {sidebarConfig['Bank Receipts'] !== false && (
            <button
              onClick={() => handleNavigationClick({ href: '/bank-receipts', name: 'Bank Receipts' })}
              className="flex flex-col items-center justify-center px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded-md shadow-sm transition-all duration-200 flex-1 max-w-[80px] flex-shrink-0"
              title="Bank Receipt"
            >
              <span className="text-[10px] font-medium whitespace-nowrap leading-tight">Bank R.</span>
            </button>
          )}

          {/* Blue Buttons - Payment related */}
          {sidebarConfig['Cash Payments'] !== false && (
            <button
              onClick={() => handleNavigationClick({ href: '/cash-payments', name: 'Cash Payments' })}
              className="flex flex-col items-center justify-center px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-sm transition-all duration-200 flex-1 max-w-[80px] flex-shrink-0"
              title="Cash Payment"
            >
              <span className="text-[10px] font-medium whitespace-nowrap leading-tight">Cash P.</span>
            </button>
          )}
          {sidebarConfig['Bank Payments'] !== false && (
            <button
              onClick={() => handleNavigationClick({ href: '/bank-payments', name: 'Bank Payments' })}
              className="flex flex-col items-center justify-center px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-sm transition-all duration-200 flex-1 max-w-[80px] flex-shrink-0"
              title="Bank Payment"
            >
              <span className="text-[10px] font-medium whitespace-nowrap leading-tight">Bank P.</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
