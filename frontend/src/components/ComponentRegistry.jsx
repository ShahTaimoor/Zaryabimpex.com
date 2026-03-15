import React from 'react';

// Dynamic component loader to avoid circular dependencies
const componentLoader = {
  '/dashboard': () => import('../pages/Dashboard').then(module => module.default || module.Dashboard),
  '/sales': () => import('../pages/Sales').then(module => module.Sales),
  '/purchase': () => import('../pages/Purchase').then(module => module.Purchase),
  '/products': () => import('../pages/Products').then(module => module.Products),
  '/customers': () => import('../pages/Customers').then(module => module.Customers),
  '/customer-analytics': () => import('../pages/CustomerAnalytics').then(module => module.default || module.CustomerAnalytics),
  '/suppliers': () => import('../pages/Suppliers').then(module => module.Suppliers),
  '/investors': () => import('../pages/Investors').then(module => module.default || module.Investors),
  '/orders': () => import('../pages/Orders').then(module => module.Orders),
  '/inventory': () => import('../pages/Inventory').then(module => module.Inventory),
  '/inventory-alerts': () => import('../pages/InventoryAlerts').then(module => module.default || module.InventoryAlerts),
  '/anomaly-detection': () => import('../pages/AnomalyDetection').then(module => module.default || module.AnomalyDetection),
  '/returns': () => import('../pages/Returns').then(module => module.default),
  '/sale-returns': () => import('../pages/SaleReturns').then(module => module.default),
  '/sales-orders': () => import('../pages/SalesOrders').then(module => module.SalesOrders),
  '/purchase-orders': () => import('../pages/PurchaseOrders').then(module => module.PurchaseOrders),
  '/purchase-invoices': () => import('../pages/PurchaseInvoices').then(module => module.default || module.PurchaseInvoices),
  '/reports': () => import('../pages/Reports').then(module => module.Reports),
  '/pl-statements': () => import('../pages/PLStatements').then(module => module.PLStatements),
  '/balance-sheets': () => import('../pages/BalanceSheets').then(module => module.default),
  '/discounts': () => import('../pages/Discounts').then(module => module.default),
  '/sales-performance': () => import('../pages/SalesPerformanceReports').then(module => module.default),
  '/inventory-reports': () => import('../pages/InventoryReports').then(module => module.default),
  '/cash-payments': () => import('../pages/CashPayments').then(module => module.default),
  '/expenses': () => import('../pages/Expenses').then(module => module.default),
  '/bank-payments': () => import('../pages/BankPayments').then(module => module.default),
  '/cash-receipts': () => import('../pages/CashReceipts').then(module => module.default),
  '/cash-receiving': () => import('../pages/CashReceiving').then(module => module.default),
  '/bank-receipts': () => import('../pages/BankReceipts').then(module => module.default),
  '/cities': () => import('../pages/Cities').then(module => module.default || module.Cities),
  '/settings': () => import('../pages/Settings').then(module => module.Settings),
  '/chart-of-accounts': () => import('../pages/ChartOfAccounts').then(module => module.default || module.ChartOfAccounts),
  '/account-ledger': () => import('../pages/AccountLedgerSummary').then(module => module.default),
  '/journal-vouchers': () => import('../pages/JournalVouchers').then(module => module.default),
  '/drop-shipping': () => import('../pages/DropShipping').then(module => module.default || module.DropShipping),
  '/help': () => import('../pages/Help').then(module => module.default || module.Help),
  '/attendance': () => import('../pages/Attendance').then(module => module.default || module.Attendance),
  '/employees': () => import('../pages/Employees').then(module => module.default || module.Employees),
  '/cctv-access': () => import('../pages/CCTVAccess').then(module => module.default || module.CCTVAccess)
};

// Component registry mapping routes to component metadata
export const componentRegistry = {
  '/dashboard': {
    title: 'Dashboard',
    icon: 'LayoutDashboard',
    allowMultiple: true
  },
  '/sales': {
    title: 'Sales',
    icon: 'CreditCard',
    allowMultiple: true
  },
  '/purchase': {
    title: 'Purchase',
    icon: 'Truck',
    allowMultiple: true
  },
  '/products': {
    title: 'Products',
    icon: 'Package'
  },
  '/customers': {
    title: 'Customers',
    icon: 'Users'
  },
  '/customer-analytics': {
    title: 'Customer Analytics',
    icon: 'BarChart3'
  },
  '/suppliers': {
    title: 'Suppliers',
    icon: 'Building'
  },
  '/investors': {
    title: 'Investors',
    icon: 'TrendingUp',
    allowMultiple: true
  },
  '/orders': {
    title: 'Orders',
    icon: 'ShoppingCart'
  },
  '/inventory': {
    title: 'Inventory',
    icon: 'Warehouse'
  },
  '/inventory-alerts': {
    title: 'Inventory Alerts',
    icon: 'AlertTriangle'
  },
  '/anomaly-detection': {
    title: 'Anomaly Detection',
    icon: 'AlertTriangle'
  },
  '/returns': {
    title: 'Returns',
    icon: 'RotateCcw'
  },
  '/sale-returns': {
    title: 'Sale Returns',
    icon: 'RotateCcw'
  },
  '/sales-orders': {
    title: 'Sales Orders',
    icon: 'FileText',
    allowMultiple: true
  },
  '/purchase-orders': {
    title: 'Purchase Orders',
    icon: 'FileText',
    allowMultiple: true
  },
  '/purchase-invoices': {
    title: 'Purchase Invoices',
    icon: 'Search',
    allowMultiple: true
  },
  '/reports': {
    title: 'Reports',
    icon: 'BarChart3'
  },
  '/pl-statements': {
    title: 'P&L Statements',
    icon: 'BarChart3'
  },
  '/balance-sheets': {
    title: 'Balance Sheets',
    icon: 'FileText'
  },
  '/discounts': {
    title: 'Discounts',
    icon: 'Tag'
  },
  '/sales-performance': {
    title: 'Sales Performance',
    icon: 'TrendingUp'
  },
  '/inventory-reports': {
    title: 'Inventory Reports',
    icon: 'Warehouse'
  },
  '/cash-payments': {
    title: 'Cash Payments',
    icon: 'CreditCard',
    allowMultiple: true
  },
  '/expenses': {
    title: 'Expenses',
    icon: 'Wallet'
  },
  '/bank-payments': {
    title: 'Bank Payments',
    icon: 'CreditCard',
    allowMultiple: true
  },
  '/cash-receipts': {
    title: 'Cash Receipts',
    icon: 'Receipt',
    allowMultiple: true
  },
  '/cash-receiving': {
    title: 'Cash Receiving',
    icon: 'Receipt',
    allowMultiple: true
  },
  '/bank-receipts': {
    title: 'Bank Receipts',
    icon: 'Receipt',
    allowMultiple: true
  },
  '/cities': {
    title: 'Cities',
    icon: 'MapPin'
  },
  '/settings': {
    title: 'Settings',
    icon: 'Settings'
  },
  '/chart-of-accounts': {
    title: 'Chart of Accounts',
    icon: 'FolderTree'
  },
  '/account-ledger': {
    title: 'Account Ledger Summary',
    icon: 'Book',
    allowMultiple: true
  },
  '/journal-vouchers': {
    title: 'Journal Vouchers',
    icon: 'FileText',
    allowMultiple: true
  },
  '/drop-shipping': {
    title: 'Drop Shipping',
    icon: 'ArrowRight',
    allowMultiple: true
  },
  '/help': {
    title: 'Help & Support',
    icon: 'HelpCircle'
  },
  '/attendance': {
    title: 'Attendance',
    icon: 'Clock',
    allowMultiple: true
  },
  '/employees': {
    title: 'Employees',
    icon: 'Users',
    allowMultiple: true
  },
  '/cctv-access': {
    title: 'CCTV Access',
    icon: 'Camera',
    allowMultiple: true
  }
};

// Helper function to get component info by path
export const getComponentInfo = (path) => {
  const info = componentRegistry[path];
  if (!info) return null;
  
  return {
    ...info,
    component: componentLoader[path]
  };
};

// Helper function to get all available routes
export const getAllRoutes = () => {
  return Object.keys(componentRegistry);
};
