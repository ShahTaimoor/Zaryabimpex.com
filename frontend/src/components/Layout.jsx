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
  HelpCircle,
  Wallet,
  FolderTree,
  Download,
  Camera
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import ErrorBoundary from './ErrorBoundary';
import MobileNavigation from './MobileNavigation';
import { useResponsive } from './ResponsiveContainer';
import { WhatsAppFloat } from './WhatsAppFloat';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const navigation = [
  // Dashboard
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, allowMultiple: true },

  // Sales Workflow
  { type: 'heading', name: 'Sales Workflow', color: 'bg-blue-500' },
  { name: 'Sales Orders', href: '/sales-orders', icon: FileText },
  { name: 'Sales', href: '/sales', icon: CreditCard },
  { name: 'Sales Invoices', href: '/sales-invoices', icon: Search },

  // Purchase Workflow
  { type: 'heading', name: 'Purchase Workflow', color: 'bg-green-500' },
  { name: 'Purchase Orders', href: '/purchase-orders', icon: FileText },
  { name: 'Purchase', href: '/purchase', icon: Truck },
  { name: 'Purchase Invoices', href: '/purchase-invoices', icon: Search },

  // Operations
  { type: 'heading', name: 'Operations', color: 'bg-teal-500' },
  { name: 'Sale Returns', href: '/sale-returns', icon: RotateCcw },
  { name: 'Purchase Returns', href: '/purchase-returns', icon: RotateCcw },
  { name: 'Returns', href: '/returns', icon: RotateCcw },
  { name: 'Discounts', href: '/discounts', icon: Tag },
  { name: 'CCTV Access', href: '/cctv-access', icon: Camera },

  // Financial Transactions
  { type: 'heading', name: 'Financial Transactions', color: 'bg-yellow-500' },
  { name: 'Cash Receipts', href: '/cash-receipts', icon: Receipt },
  { name: 'Cash Payments', href: '/cash-payments', icon: CreditCard },
  { name: 'Bank Receipts', href: '/bank-receipts', icon: Building },
  { name: 'Bank Payments', href: '/bank-payments', icon: ArrowUpDown },
  { name: 'Record Expense', href: '/expenses', icon: Wallet },

  // Master Data
  { type: 'heading', name: 'Master Data', color: 'bg-purple-500' },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Categories', href: '/categories', icon: Tag },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Suppliers', href: '/suppliers', icon: Building },
  { name: 'Banks', href: '/banks', icon: Building2 },
  { name: 'Investors', href: '/investors', icon: TrendingUp },
  { name: 'Drop Shipping', href: '/drop-shipping', icon: ArrowRight },

  // Inventory Management
  { type: 'heading', name: 'Inventory Management', color: 'bg-orange-500' },
  { name: 'Inventory', href: '/inventory', icon: Warehouse },
  { name: 'Warehouses', href: '/warehouses', icon: Warehouse },
  { name: 'Stock Movements', href: '/stock-movements', icon: ArrowUpDown },
  { name: 'Stock Ledger', href: '/stock-ledger', icon: FileText },

  // Accounting
  { type: 'heading', name: 'Accounting', color: 'bg-pink-500' },
  { name: 'Chart of Accounts', href: '/chart-of-accounts', icon: FolderTree },
  { name: 'Journal Vouchers', href: '/journal-vouchers', icon: FileText },
  { name: 'Account Ledger Summary', href: '/account-ledger', icon: FileText },

  // Reports & Analytics
  { type: 'heading', name: 'Reports & Analytics', color: 'bg-indigo-500' },
  { name: 'P&L Statements', href: '/pl-statements', icon: BarChart3 },
  { name: 'Balance Sheets', href: '/balance-sheets', icon: FileText },
  { name: 'Sales Performance', href: '/sales-performance', icon: TrendingUp },
  { name: 'Inventory Reports', href: '/inventory-reports', icon: Warehouse },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Backdate Report', href: '/backdate-report', icon: Clock },

  // System Management
  { type: 'heading', name: 'System Management', color: 'bg-red-500' },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Migration', href: '/migration', icon: RefreshCw },
  { name: 'Help & Support', href: '/help', icon: HelpCircle },
];

// Category Tree Component
const CategoryTreeItem = ({ category, subcategories, isActive, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = subcategories && subcategories.length > 0;

  return (
    <div>
      <Link
        to={`/products?category=${category._id}`}
        className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive
          ? 'bg-primary-100 text-primary-900'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        style={{ paddingLeft: `${0.5 + level * 1}rem` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }}
            className="mr-1"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}
        {!hasChildren && <span className="w-5 mr-1" />}
        <Tag className="mr-2 h-4 w-4 flex-shrink-0" />
        <span className="truncate">{category.name}</span>
      </Link>
      {hasChildren && isExpanded && (
        <div className="ml-2">
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

import { useGetCategoriesQuery } from '../store/services/categoriesApi';

export const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [categoryTree, setCategoryTree] = useState([]);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const { isInstallable, handleInstallClick } = usePWAInstall();

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

  // Filtered navigation
  const filteredNavigation = React.useMemo(() => {
    return navigation.reduce((acc, item, index) => {
      if (item.type === 'heading') {
        const subItems = [];
        for (let i = index + 1; i < navigation.length; i++) {
          if (navigation[i].type === 'heading') break;
          if (navigation[i].name) subItems.push(navigation[i]);
        }
        const hasVisibleSubItem = subItems.some(subItem => sidebarConfig[subItem.name] !== false);
        if (hasVisibleSubItem) acc.push(item);
      } else if (item.name) {
        if (sidebarConfig[item.name] !== false) acc.push(item);
      } else {
        acc.push(item);
      }
      return acc;
    }, []);
  }, [sidebarConfig]);

  // Redirect if current page is hidden
  useEffect(() => {
    if (!user || filteredNavigation.length === 0) return;
    const currentPath = location.pathname;
    if (currentPath === '/settings' || currentPath === '/settings2' || currentPath === '/login') {
      return;
    }

    const currentNavItem = navigation.find(item => item.href === currentPath);
    if (currentNavItem && currentNavItem.name) {
      if (sidebarConfig[currentNavItem.name] === false) {
        const firstVisiblePage = filteredNavigation.find(item => item.href && item.name && item.type !== 'heading');
        if (firstVisiblePage && firstVisiblePage.href !== currentPath) {
          navigate(firstVisiblePage.href);
        }
      }
    }
  }, [location.pathname, sidebarConfig, filteredNavigation, user, navigate]);


  // Fetch categories using Redux
  const { data: categoriesData, isLoading: categoriesLoading, refetch: refetchCategories } = useGetCategoriesQuery(
    {},
    { skip: !user }
  );

  const categories = categoriesData?.data?.categories || categoriesData?.categories || [];

  // Build category tree when categories change
  useEffect(() => {
    if (categories.length > 0) {
      const tree = buildCategoryTree(categories);
      setCategoryTree(tree);
    } else {
      setCategoryTree([]);
    }
  }, [categories]);

  // Build hierarchical category tree
  const buildCategoryTree = (categories) => {
    const categoryMap = {};
    const tree = [];

    // Create a map of categories by ID
    categories.forEach(cat => {
      categoryMap[cat._id] = { category: cat, subcategories: [] };
    });

    // Build the tree structure
    categories.forEach(cat => {
      if (cat.parentCategory && categoryMap[cat.parentCategory]) {
        categoryMap[cat.parentCategory].subcategories.push(categoryMap[cat._id]);
      } else {
        tree.push(categoryMap[cat._id]);
      }
    });

    return tree;
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

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
            {filteredNavigation.map((item, index) => {
              if (item.type === 'divider') {
                return (
                  <div key={`divider-${index}`} className="my-2 border-t border-gray-200"></div>
                );
              }

              if (item.type === 'heading') {
                return (
                  <div key={`heading-${index}`} className={`${item.color} text-white px-3 py-2 mt-3 mb-1 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm`}>
                    {item.name}
                  </div>
                );
              }

              const isActive = location.pathname === item.href;
              return (
                <div key={item.name}>
                  <Link
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive
                      ? 'bg-primary-100 text-primary-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>

                  {/* Show category tree after Categories link */}
                  {item.name === 'Categories' && (
                    <div className="mt-1 ml-3">
                      {categoriesLoading ? (
                        <div className="px-2 py-1 text-xs text-gray-500 italic flex items-center">
                          <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                          Loading categories...
                        </div>
                      ) : categoryTree.length > 0 ? (
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
                          <span>No categories yet</span>
                          <button
                            onClick={() => refetchCategories()}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                            title="Refresh categories"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="px-2 py-1 text-xs text-gray-500 italic">
                          Login to see categories
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
            {filteredNavigation.map((item, index) => {
              if (item.type === 'divider') {
                return (
                  <div key={`divider-${index}`} className="my-2 border-t border-gray-200"></div>
                );
              }

              if (item.type === 'heading') {
                return (
                  <div key={`heading-${index}`} className={`${item.color} text-white px-3 py-2 mt-3 mb-1 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm`}>
                    {item.name}
                  </div>
                );
              }

              const isActive = location.pathname === item.href;
              return (
                <div key={item.name}>
                  <Link
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive
                      ? 'bg-primary-100 text-primary-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>

                  {/* Show category tree after Categories link */}
                  {item.name === 'Categories' && (
                    <div className="mt-1 ml-3">
                      {categoriesLoading ? (
                        <div className="px-2 py-1 text-xs text-gray-500 italic flex items-center">
                          <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                          Loading categories...
                        </div>
                      ) : categoryTree.length > 0 ? (
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
                          <span>No categories yet</span>
                          <button
                            onClick={() => refetchCategories()}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                            title="Refresh categories"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="px-2 py-1 text-xs text-gray-500 italic">
                          Login to see categories
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex flex-1 gap-x-2 sm:gap-x-4 self-stretch lg:gap-x-6 min-w-0 overflow-hidden">
            {/* Financial Transaction Buttons - Responsive */}
            <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
              {sidebarConfig['Cash Receipts'] !== false && (
                <button
                  onClick={() => navigate('/cash-receipts')}
                  className="bg-green-500 hover:bg-green-600 text-white px-2 sm:px-3 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-1 text-xs sm:text-sm font-medium flex-shrink-0"
                >
                  <Receipt className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden md:inline">Cash Receipts</span>
                </button>
              )}
              {sidebarConfig['Cash Payments'] !== false && (
                <button
                  onClick={() => navigate('/cash-payments')}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-2 sm:px-3 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-1 text-xs sm:text-sm font-medium flex-shrink-0"
                >
                  <CreditCard className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden md:inline">Cash Payments</span>
                </button>
              )}
              {sidebarConfig['Bank Receipts'] !== false && (
                <button
                  onClick={() => navigate('/bank-receipts')}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-2 sm:px-3 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-1 text-xs sm:text-sm font-medium flex-shrink-0"
                >
                  <Building className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden md:inline">Bank Receipts</span>
                </button>
              )}
              {sidebarConfig['Bank Payments'] !== false && (
                <button
                  onClick={() => navigate('/bank-payments')}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-2 sm:px-3 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-1 text-xs sm:text-sm font-medium flex-shrink-0"
                >
                  <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden md:inline">Bank Payments</span>
                </button>
              )}
            </div>
            <div className="flex flex-1 min-w-0"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* PWA Install Button */}
              {isInstallable && (
                <button
                  onClick={handleInstallClick}
                  className="flex items-center gap-x-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm"
                  title="Install App"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Install App</span>
                </button>
              )}


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
                  onClick={logout}
                  className="text-gray-400 hover:text-gray-600"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

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
