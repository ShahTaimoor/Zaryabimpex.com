import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  Home,
  ShoppingCart,
  Package,
  Users,
  Truck,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  User,
  Bell,
  Search,
  RotateCcw,
  Tag,
  TrendingUp,
  Warehouse,
  Clock,
  ArrowUpDown,
  ArrowRight,
  FolderTree,
  Building2,
  Receipt,
  CreditCard,
  Camera,
  Wallet
} from 'lucide-react';
import { useResponsive } from './ResponsiveContainer';
import { useAuth } from '../contexts/AuthContext';

const MobileNavigation = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();
  const { isMobile, isTablet } = useResponsive();
  const { hasPermission } = useAuth();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
    setIsSearchOpen(false);
  }, [location]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && !event.target.closest('.mobile-menu')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const navigationItems = [
    { path: '/', icon: Home, label: 'Dashboard', badge: null, permission: null }, // Always visible
    { path: '/sales', icon: ShoppingCart, label: 'Sales', badge: null, permission: 'view_sales_orders' },
    { path: '/sales-orders', icon: FileText, label: 'Sales Orders', badge: null, permission: 'view_sales_orders' },
    { path: '/sales-invoices', icon: FileText, label: 'Sales Invoices', badge: null, permission: 'view_sales_invoices' },
    { path: '/purchase', icon: Truck, label: 'Purchase', badge: null, permission: 'view_purchase_orders' },
    { path: '/purchase-orders', icon: FileText, label: 'Purchase Orders', badge: null, permission: 'view_purchase_orders' },
    { path: '/purchase-invoices', icon: FileText, label: 'Purchase Invoices', badge: null, permission: 'view_purchase_invoices' },
    { path: '/products', icon: Package, label: 'Products', badge: null, permission: 'view_products' },
    { path: '/customers', icon: Users, label: 'Customers', badge: null, permission: 'view_customers' },
    { path: '/suppliers', icon: Truck, label: 'Suppliers', badge: null, permission: 'view_suppliers' },
    { path: '/banks', icon: Building2, label: 'Banks', badge: null, permission: null },
    { path: '/investors', icon: TrendingUp, label: 'Investors', badge: null, permission: 'view_investors' },
    { path: '/drop-shipping', icon: ArrowRight, label: 'Drop Shipping', badge: null, permission: 'create_drop_shipping' },
    { path: '/inventory', icon: Package, label: 'Inventory', badge: null, permission: 'view_inventory' },
    { path: '/stock-movements', icon: ArrowUpDown, label: 'Stock Movements', badge: null, permission: 'view_stock_movements' },
    { path: '/stock-ledger', icon: FileText, label: 'Stock Ledger', badge: null, permission: 'view_reports' },
    { path: '/sale-returns', icon: RotateCcw, label: 'Sale Returns', badge: null, permission: 'view_returns' },
    { path: '/purchase-returns', icon: RotateCcw, label: 'Purchase Returns', badge: null, permission: 'view_returns' },
    { path: '/returns', icon: RotateCcw, label: 'Returns', badge: null, permission: 'view_returns' },
    { path: '/discounts', icon: Tag, label: 'Discounts', badge: null, permission: 'view_discounts' },
    { path: '/pl-statements', icon: BarChart3, label: 'P&L Statements', badge: null, permission: 'view_pl_statements' },
    { path: '/balance-sheets', icon: FileText, label: 'Balance Sheets', badge: null, permission: 'view_balance_sheets' },
    { path: '/sales-performance', icon: TrendingUp, label: 'Sales Performance', badge: null, permission: 'view_sales_performance' },
    { path: '/inventory-reports', icon: Warehouse, label: 'Inventory Reports', badge: null, permission: 'view_inventory_reports' },
    { path: '/reports', icon: BarChart3, label: 'Reports', badge: null, permission: 'view_general_reports' },
    { path: '/backdate-report', icon: Clock, label: 'Backdate Report', badge: null, permission: 'view_backdate_report' },
    { path: '/chart-of-accounts', icon: FolderTree, label: 'Chart of Accounts', badge: null, permission: 'view_chart_of_accounts' },
    { path: '/journal-vouchers', icon: FileText, label: 'Journal Vouchers', badge: null, permission: 'view_reports' },
    { path: '/account-ledger', icon: FileText, label: 'Account Ledger Summary', badge: null, permission: 'view_reports' },
    { path: '/employees', icon: Users, label: 'Employees', badge: null, permission: 'manage_users' },
    { path: '/attendance', icon: Clock, label: 'Attendance', badge: null, permission: 'view_own_attendance' },
    { path: '/settings', icon: Settings, label: 'Settings', badge: null, permission: 'manage_users' },
    { path: '/expenses', icon: Wallet, label: 'Record Expense', badge: null, permission: 'view_reports' },
    { path: '/cash-receipts', icon: Receipt, label: 'Cash Receipts', badge: null, permission: 'view_reports' },
    { path: '/cash-payments', icon: CreditCard, label: 'Cash Payments', badge: null, permission: 'view_reports' },
    { path: '/cctv-access', icon: Camera, label: 'CCTV Access', badge: null, permission: 'view_sales_invoices' }
  ];

  // Sidebar visibility state
  const [sidebarConfig, setSidebarConfig] = useState(() => {
    const saved = localStorage.getItem('sidebarConfig');
    return saved ? JSON.parse(saved) : {};
  });

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

  // Filter navigation based on user permissions AND sidebar configuration
  const filteredNavigationItems = navigationItems.filter(item => {
    // 1. Check sidebar configuration first
    if (sidebarConfig[item.label] === false) return false;

    // 2. Check permissions
    if (!item.permission) return true; // Always show items without permission requirement
    if (user?.role === 'admin') return true; // Admin users see everything
    return hasPermission(item.permission);
  });

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  if (!isMobile && !isTablet) {
    return null;
  }

  return (
    <>
      {/* Mobile Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <Search className="h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products, customers, orders..."
                  className="flex-1 text-sm border-none outline-none"
                  autoFocus
                />
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-500">Search functionality coming soon...</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:hidden">
          <div className="mobile-menu fixed inset-y-0 left-0 w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-primary-600 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4">
              <div className="px-4 space-y-1">
                {filteredNavigationItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${active
                        ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                      <Icon className={`mr-3 h-5 w-5 ${active ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                        }`} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={onLogout}
                className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors"
              >
                <LogOut className="mr-3 h-5 w-5 text-gray-400" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileNavigation;
