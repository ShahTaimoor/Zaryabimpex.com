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
  Camera,
  Layers,
  PieChart,
  ClipboardList
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import ErrorBoundary from './ErrorBoundary';
import MobileNavigation from './MobileNavigation';
import { useResponsive } from './ResponsiveContainer';
import { WhatsAppFloat } from './WhatsAppFloat';
import { useGetCategoriesQuery } from '../store/services/categoriesApi';

// Revised Navigation Structure
export const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  
  {
    name: 'Sales',
    icon: ShoppingCart,
    children: [
      { name: 'Sales Orders', href: '/sales-orders', icon: FileText },
      { name: 'Sales', href: '/sales', icon: CreditCard },
      { name: 'Sales Invoices', href: '/sales-invoices', icon: Search },
    ]
  },

  {
    name: 'Purchase',
    icon: Truck,
    children: [
      { name: 'Purchase Orders', href: '/purchase-orders', icon: FileText },
      { name: 'Purchase', href: '/purchase', icon: Truck },
      { name: 'Purchase Invoices', href: '/purchase-invoices', icon: Search },
      { name: 'Products by Supplier', href: '/purchase-by-supplier', icon: BarChart3 },
    ]
  },

  {
    name: 'Operations',
    icon: Layers,
    children: [
      { name: 'Sale Returns', href: '/sale-returns', icon: RotateCcw },
      { name: 'Purchase Returns', href: '/purchase-returns', icon: RotateCcw },
      { name: 'Discounts', href: '/discounts', icon: Tag },
      { name: 'CCTV Access', href: '/cctv-access', icon: Camera },
    ]
  },

  {
    name: 'Financials',
    icon: Wallet,
    children: [
      { name: 'Cash Receipts', href: '/cash-receipts', icon: Receipt },
      { name: 'Cash Payments', href: '/cash-payments', icon: CreditCard },
      { name: 'Bank Receipts', href: '/bank-receipts', icon: Building },
      { name: 'Bank Payments', href: '/bank-payments', icon: ArrowUpDown },
      { name: 'Record Expense', href: '/expenses', icon: Wallet },
    ]
  },

  {
    name: 'Master Data',
    icon: DatabaseIcon, // We'll need a different icon or reuse one
    children: [
      { name: 'Products', href: '/products', icon: Package },
      { name: 'Categories', href: '/categories', icon: Tag },
      { name: 'Customers', href: '/customers', icon: Users },
      { name: 'Suppliers', href: '/suppliers', icon: Building },
      { name: 'Banks', href: '/banks', icon: Building2 },
      { name: 'Investors', href: '/investors', icon: TrendingUp },
      { name: 'Drop Shipping', href: '/drop-shipping', icon: ArrowRight },
    ]
  },

  {
    name: 'Inventory',
    icon: Warehouse,
    children: [
      { name: 'Inventory', href: '/inventory', icon: Warehouse },
      { name: 'Warehouses', href: '/warehouses', icon: Warehouse },
      { name: 'Stock Movements', href: '/stock-movements', icon: ArrowUpDown },
      { name: 'Stock Ledger', href: '/stock-ledger', icon: FileText },
    ]
  },

  {
    name: 'Accounting',
    icon: ClipboardList,
    children: [
      { name: 'Chart of Accounts', href: '/chart-of-accounts', icon: FolderTree },
      { name: 'Journal Vouchers', href: '/journal-vouchers', icon: FileText },
      { name: 'Account Ledger Summary', href: '/account-ledger', icon: FileText },
    ]
  },

  {
    name: 'Analytics',
    icon: BarChart3,
    children: [
      { name: 'P&L Statements', href: '/pl-statements', icon: BarChart3 },
      { name: 'Balance Sheets', href: '/balance-sheets', icon: FileText },
      { name: 'Sales Performance', href: '/sales-performance', icon: TrendingUp },
      { name: 'Inventory Reports', href: '/inventory-reports', icon: Warehouse },
      { name: 'Reports', href: '/reports', icon: BarChart3 },
      { name: 'Backdate Report', href: '/backdate-report', icon: Clock },
    ]
  },

  {
    name: 'System',
    icon: Settings,
    children: [
      { name: 'Settings', href: '/settings', icon: Settings },
      { name: 'Migration', href: '/migration', icon: RefreshCw },
      { name: 'Help & Support', href: '/help', icon: HelpCircle },
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
  System: { bg: 'bg-slate-50', hover: 'hover:bg-slate-100', border: 'border-slate-200' },
};
const getHeaderColors = (name) => sidebarHeaderColors[name] || { bg: 'bg-slate-50', hover: 'hover:bg-slate-100', border: 'border-slate-200' };
const defaultOpenSections = ['Sales', 'Purchase', 'Operations'];
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

  // Check visibility based on config
  if (sidebarConfig && sidebarConfig[item.name] === false) return null;
  
  // If group, check if any child is visible
  if (hasChildren) {
    const hasVisibleChild = item.children.some(child => sidebarConfig?.[child.name] !== false);
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
            className={`w-full group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
              isOpen ? `text-gray-900 ${colors.bg}` : `text-gray-600 ${colors.bg} ${colors.hover} hover:text-gray-900`
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
            className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
              isActive
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
             {item.icon && <item.icon className={`mr-3 h-4 w-4 ${isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'}`} />}
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
  const [categoryTree, setCategoryTree] = useState([]);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  
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

  // Fetch categories using Redux
  const { data: categoriesData, isLoading: categoriesLoading, refetch: refetchCategories } = useGetCategoriesQuery(
    { limit: 999999 },
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
  
  const isActivePath = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Navigation */}
      <MobileNavigation user={user} onLogout={handleLogout} />

      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
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
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
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
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-emerald-200/60 flex-shrink-0">
                    <Receipt className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-emerald-700" />
                  </span>
                  <span className="hidden md:inline">Cash Receipts</span>
                </button>
              )}
              {sidebarConfig['Bank Receipts'] !== false && (
                <button
                  onClick={() => navigate('/bank-receipts')}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-emerald-200/60 flex-shrink-0">
                    <Building className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-emerald-700" />
                  </span>
                  <span className="hidden md:inline">Bank Receipts</span>
                </button>
              )}
              {sidebarConfig['Cash Payments'] !== false && (
                <button
                  onClick={() => navigate('/cash-payments')}
                  className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-blue-200/60 flex-shrink-0">
                    <CreditCard className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-blue-700" />
                  </span>
                  <span className="hidden md:inline">Cash Payments</span>
                </button>
              )}
              {sidebarConfig['Bank Payments'] !== false && (
                <button
                  onClick={() => navigate('/bank-payments')}
                  className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-blue-200/60 flex-shrink-0">
                    <ArrowUpDown className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-blue-700" />
                  </span>
                  <span className="hidden md:inline">Bank Payments</span>
                </button>
              )}
              {sidebarConfig['Record Expense'] !== false && (
                <button
                  onClick={() => navigate('/expenses')}
                  className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-red-200/60 flex-shrink-0">
                    <Wallet className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-red-700" />
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

