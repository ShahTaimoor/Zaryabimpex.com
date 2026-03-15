// Utility functions for component management
// This file avoids circular dependencies by not importing components directly

// Component registry mapping routes to component metadata
export const componentRegistry = {
  '/dashboard': {
    title: 'Dashboard',
    icon: 'LayoutDashboard',
    allowMultiple: true,
    component: () => import('../pages/Dashboard').then(m => m.default || m.Dashboard)
  },
  '/sales': {
    title: 'Sales',
    icon: 'CreditCard',
    allowMultiple: true,
    component: () => import('../pages/Sales').then(m => m.default || m.Sales)
  },
  '/purchase': {
    title: 'Purchase',
    icon: 'Truck',
    allowMultiple: true,
    component: () => import('../pages/Purchase').then(m => m.default || m.Purchase)
  },
  '/products': {
    title: 'Products',
    icon: 'Package',
    component: () => import('../pages/Products').then(m => m.default || m.Products)
  },
  '/customers': {
    title: 'Customers',
    icon: 'Users',
    component: () => import('../pages/Customers').then(m => m.default || m.Customers)
  },
  '/customer-analytics': {
    title: 'Customer Analytics',
    icon: 'BarChart3',
    component: () => import('../pages/CustomerAnalytics').then(m => m.default || m.CustomerAnalytics)
  },
  '/anomaly-detection': {
    title: 'Anomaly Detection',
    icon: 'AlertTriangle',
    component: () => import('../pages/AnomalyDetection').then(m => m.default || m.AnomalyDetection)
  },
  '/suppliers': {
    title: 'Suppliers',
    icon: 'Building',
    component: () => import('../pages/Suppliers').then(m => m.default || m.Suppliers)
  },
  '/investors': {
    title: 'Investors',
    icon: 'TrendingUp',
    allowMultiple: true,
    component: () => import('../pages/Investors').then(m => m.default || m.Investors)
  },
  '/orders': {
    title: 'Orders',
    icon: 'ShoppingCart',
    component: () => import('../pages/Orders').then(m => m.default || m.Orders)
  },
  '/sales-invoices': {
    title: 'Sales Invoices',
    icon: 'Search',
    component: () => import('../pages/Orders').then(m => m.default || m.Orders)
  },
  '/inventory': {
    title: 'Inventory',
    icon: 'Warehouse',
    component: () => import('../pages/Inventory').then(m => m.default || m.Inventory)
  },
  '/inventory-alerts': {
    title: 'Inventory Alerts',
    icon: 'AlertTriangle',
    component: () => import('../pages/InventoryAlerts').then(m => m.default || m.InventoryAlerts)
  },
  '/warehouses': {
    title: 'Warehouses',
    icon: 'Warehouse',
    component: () => import('../pages/Warehouses').then(m => m.default)
  },
  '/stock-movements': {
    title: 'Stock Movements',
    icon: 'ArrowUpDown',
    component: () => import('../pages/StockMovements').then(m => m.default || m.StockMovements)
  },
  '/stock-ledger': {
    title: 'Stock Ledger',
    icon: 'FileText',
    component: () => import('../pages/StockLedger').then(m => m.default || m.StockLedger)
  },
  '/returns': {
    title: 'Returns',
    icon: 'RotateCcw',
    component: () => import('../pages/Returns').then(m => m.default || m.Returns)
  },
  '/sale-returns': {
    title: 'Sale Returns',
    icon: 'RotateCcw',
    component: () => import('../pages/SaleReturns').then(m => m.default || m.SaleReturns)
  },
  '/purchase-returns': {
    title: 'Purchase Returns',
    icon: 'RotateCcw',
    component: () => import('../pages/PurchaseReturns').then(m => m.default || m.PurchaseReturns)
  },
  '/sales-orders': {
    title: 'Sales Orders',
    icon: 'FileText',
    allowMultiple: true,
    component: () => import('../pages/SalesOrders').then(m => m.default || m.SalesOrders)
  },
  '/purchase-orders': {
    title: 'Purchase Orders',
    icon: 'FileText',
    allowMultiple: true,
    component: () => import('../pages/PurchaseOrders').then(m => m.default || m.PurchaseOrders)
  },
  '/purchase-invoices': {
    title: 'Purchase Invoices',
    icon: 'Search',
    component: () => import('../pages/PurchaseInvoices').then(m => m.default || m.PurchaseInvoices)
  },
  '/reports': {
    title: 'Reports',
    icon: 'BarChart3',
    component: () => import('../pages/Reports').then(m => m.default || m.Reports)
  },
  '/backdate-report': {
    title: 'Backdate Report',
    icon: 'Clock',
    component: () => import('../pages/BackdateReport').then(m => m.default || m.BackdateReport)
  },
  '/pl-statements': {
    title: 'P&L Statements',
    icon: 'BarChart3',
    component: () => import('../pages/PLStatements').then(m => m.default || m.PLStatements)
  },
  '/balance-sheets': {
    title: 'Balance Sheets',
    icon: 'FileText',
    component: () => import('../pages/BalanceSheets').then(m => m.default || m.BalanceSheets)
  },
  '/discounts': {
    title: 'Discounts',
    icon: 'Tag',
    component: () => import('../pages/Discounts').then(m => m.default || m.Discounts)
  },
  '/sales-performance': {
    title: 'Sales Performance',
    icon: 'TrendingUp',
    component: () => import('../pages/SalesPerformanceReports').then(m => m.default || m.SalesPerformanceReports)
  },
  '/inventory-reports': {
    title: 'Inventory Reports',
    icon: 'Warehouse',
    component: () => import('../pages/InventoryReports').then(m => m.default || m.InventoryReports)
  },
  '/cash-payments': {
    title: 'Cash Payments',
    icon: 'CreditCard',
    allowMultiple: true,
    component: () => import('../pages/CashPayments').then(m => m.default || m.CashPayments)
  },
  '/expenses': {
    title: 'Expenses',
    icon: 'Wallet',
    component: () => import('../pages/Expenses').then(m => m.default || m.Expenses)
  },
  '/bank-payments': {
    title: 'Bank Payments',
    icon: 'CreditCard',
    allowMultiple: true,
    component: () => import('../pages/BankPayments').then(m => m.default || m.BankPayments)
  },
  '/cash-receipts': {
    title: 'Cash Receipts',
    icon: 'Receipt',
    allowMultiple: true,
    component: () => import('../pages/CashReceipts').then(m => m.default || m.CashReceipts)
  },
  '/cash-receiving': {
    title: 'Cash Receiving',
    icon: 'Receipt',
    allowMultiple: true,
    component: () => import('../pages/CashReceiving').then(m => m.default || m.CashReceiving)
  },
  '/bank-receipts': {
    title: 'Bank Receipts',
    icon: 'Receipt',
    allowMultiple: true,
    component: () => import('../pages/BankReceipts').then(m => m.default || m.BankReceipts)
  },
  '/cities': {
    title: 'Cities',
    icon: 'MapPin',
    component: () => import('../pages/Cities').then(m => m.default || m.Cities)
  },
  '/banks': {
    title: 'Banks',
    icon: 'Building',
    component: () => import('../pages/Banks').then(m => m.default || m.Banks)
  },
  '/settings': {
    title: 'Settings',
    icon: 'Settings',
    component: () => import('../pages/Settings').then(m => m.default || m.Settings2)
  },
  '/settings2': {
    title: 'Settings',
    icon: 'Settings',
    component: () => import('../pages/Settings').then(m => m.default || m.Settings2)
  },
  '/chart-of-accounts': {
    title: 'Chart of Accounts',
    icon: 'FolderTree',
    component: () => import('../pages/ChartOfAccounts').then(m => m.default || m.ChartOfAccounts)
  },
  '/account-ledger': {
    title: 'Account Ledger Summary',
    icon: 'Book',
    allowMultiple: true,
    component: () => import('../pages/AccountLedgerSummary').then(m => m.default || m.AccountLedgerSummary)
  },
  '/journal-vouchers': {
    title: 'Journal Vouchers',
    icon: 'FileText',
    allowMultiple: true,
    component: () => import('../pages/JournalVouchers').then(m => m.default || m.JournalVouchers)
  },
  '/categories': {
    title: 'Categories',
    icon: 'Tag',
    component: () => import('../pages/Categories').then(m => m.default || m.Categories)
  },
  '/product-variants': {
    title: 'Product Variants',
    icon: 'Tag',
    allowMultiple: true,
    component: () => import('../pages/ProductVariants').then(m => m.default || m.ProductVariants)
  },
  '/product-transformations': {
    title: 'Product Transformations',
    icon: 'ArrowRight',
    allowMultiple: true,
    component: () => import('../pages/ProductTransformations').then(m => m.default || m.ProductTransformations)
  },
  '/drop-shipping': {
    title: 'Drop Shipping',
    icon: 'ArrowRight',
    allowMultiple: true,
    component: () => import('../pages/DropShipping').then(m => m.default || m.DropShipping)
  },
  '/attendance': {
    title: 'Attendance',
    icon: 'Clock',
    allowMultiple: true,
    component: () => import('../pages/Attendance').then(m => m.default || m.Attendance)
  },
  '/employees': {
    title: 'Employees',
    icon: 'Users',
    allowMultiple: true,
    component: () => import('../pages/Employees').then(m => m.default || m.Employees)
  },
  '/cctv-access': {
    title: 'CCTV Access',
    icon: 'Camera',
    allowMultiple: true,
    component: () => import('../pages/CCTVAccess').then(m => m.default || m.CCTVAccess)
  }
};

// Helper function to get component info by path
export const getComponentInfo = (path) => {
  return componentRegistry[path] || null;
};

// Helper function to get all available routes
export const getAllRoutes = () => {
  return Object.keys(componentRegistry);
};
