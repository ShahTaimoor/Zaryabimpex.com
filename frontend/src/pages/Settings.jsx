import React, { useState, useEffect, useMemo } from 'react';
import {
  Building,
  Phone,
  MapPin,
  Mail,
  Save,
  User,
  Users,
  Plus,
  Trash2,
  Edit,
  Shield,
  UserCheck,
  FileText,
  Printer,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  X,
  Check,
  BarChart3,
  Clock,
  TrendingUp,
  LayoutDashboard,
  AlertCircle,
  UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetCompanySettingsQuery,
  useUpdateCompanySettingsMutation,
} from '../store/services/settingsApi';
import { useFetchCompanyQuery } from '../store/services/companyApi';
import {
  useGetUsersQuery,
  useGetUserActivityQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useResetPasswordMutation,
  useUpdateRolePermissionsMutation,
} from '../store/services/usersApi';
import { navigation, loadSidebarConfig } from '../components/MultiTabLayout';
import { useChangePasswordMutation } from '../store/services/authApi';
import { LoadingSpinner, LoadingButton } from '../components/LoadingSpinner';
import PrintDocument from '../components/PrintDocument';
import { CompanySettingsForm } from '../components/CompanySettingsForm';
import { OrderItemWiseConfirmationSettings } from '../components/OrderItemWiseConfirmationSettings';
import { handleApiError } from '../utils/errorHandler';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export const Settings2 = () => {
  const { user } = useAuth();

  // Active tab state
  const [activeTab, setActiveTab] = useState('company');

  // Company Information State
  const [companyData, setCompanyData] = useState({
    companyName: '',
    address: '',
    contactNumber: '',
    email: '',
    taxRegistrationNumber: ''
  });
  const [savingCompanySettings, setSavingCompanySettings] = useState(false);

  // User Management State
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [newUserData, setNewUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'cashier',
    status: 'active',
    permissions: {}
  });
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMyPasswordModal, setShowMyPasswordModal] = useState(false);
  const [isSavingPrintSettings, setIsSavingPrintSettings] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [rolePermissionsChanged, setRolePermissionsChanged] = useState({});
  const [selectedUserActivity, setSelectedUserActivity] = useState(null);
  const [showActivityModal, setShowActivityModal] = useState(false);

  // Print Preview Settings State
  const [printSettings, setPrintSettings] = useState({
    showLogo: true,
    showCompanyDetails: true,
    showDiscount: true,
    showTax: true,
    showDate: true,
    showFooter: true,
    showCameraTime: false,
    showDescription: true,
    showEmail: true,
    showPrintBusinessName: true,
    showPrintContactName: true,
    showPrintAddress: true,
    showPrintCity: true,
    showPrintState: true,
    showPrintPostalCode: true,
    showPrintInvoiceNumber: true,
    showPrintInvoiceDate: true,
    showPrintInvoiceStatus: true,
    showPrintInvoiceType: true,
    showPrintPaymentStatus: true,
    showPrintPaymentMethod: true,
    showPrintPaymentAmount: true,
    mobilePrintPreview: false,
    headerText: '',
    footerText: '',
    invoiceLayout: 'standard',
    logoSize: 100
  });

  const sampleOrderData = useMemo(() => ({
    invoiceNumber: 'INV-PREVIEW',
    createdAt: new Date(),
    customer: {
      name: 'Walk-in Customer',
      displayName: 'Jane Smith',
      businessName: 'Sample Business Ltd',
      phone: '555-0123',
      email: 'jane@example.com',
      address: '123 Main Street',
      currentBalance: 15450.75,
      addresses: [{ street: '123 Main Street', city: 'New York', state: 'NY', country: 'US', zipCode: '10001', isDefault: true }]
    },
    customerInfo: {
      name: 'Jane Smith',
      businessName: 'Sample Business Ltd',
      phone: '555-0123',
      email: 'jane@example.com',
      address: '123 Main Street, New York, NY, US, 10001'
    },
    items: [
      { name: 'Sample Item 1', quantity: 2, unitPrice: 50.00, total: 100.00 },
      { name: 'Sample Item 2', quantity: 1, unitPrice: 25.00, total: 25.00 }
    ],
    subtotal: 125.00,
    tax: 12.50,
    discount: 5.00,
    total: 132.50,
    payment: {
      method: 'Cash',
      status: 'Paid',
      amountPaid: 132.50
    },
    billStartTime: new Date(Date.now() - 300000), // 5 min ago
    billEndTime: new Date()
  }), []);

  // Permission categories (matching backend User model enum)
  const permissionCategories = {
    products: {
      name: 'Product Management',
      permissions: [
        {
          key: 'view_products',
          name: 'View Products',
          subcategories: [
            { key: 'view_product_list', name: 'Product List' },
            { key: 'view_product_details', name: 'Product Details' },
            { key: 'view_product_categories', name: 'Categories' },
            { key: 'view_product_inventory', name: 'Inventory Levels' }
          ]
        },
        { key: 'create_products', name: 'Create Products' },
        { key: 'edit_products', name: 'Edit Products' },
        { key: 'delete_products', name: 'Delete Products' }
      ]
    },
    customers: {
      name: 'Customer Management',
      permissions: [
        {
          key: 'view_customers',
          name: 'View Customers',
          subcategories: [
            { key: 'view_customer_list', name: 'Customer List' },
            { key: 'view_customer_details', name: 'Customer Details' },
            { key: 'view_customer_history', name: 'Purchase History' },
            { key: 'view_customer_balance', name: 'Account Balance' }
          ]
        },
        { key: 'create_customers', name: 'Create Customers' },
        { key: 'edit_customers', name: 'Edit Customers' },
        { key: 'delete_customers', name: 'Delete Customers' }
      ]
    },
    suppliers: {
      name: 'Supplier Management',
      permissions: [
        {
          key: 'view_suppliers',
          name: 'View Suppliers',
          subcategories: [
            { key: 'view_supplier_list', name: 'Supplier List' },
            { key: 'view_supplier_details', name: 'Supplier Details' },
            { key: 'view_supplier_orders', name: 'Purchase Orders' },
            { key: 'view_supplier_balance', name: 'Account Balance' }
          ]
        },
        { key: 'create_suppliers', name: 'Create Suppliers' },
        { key: 'edit_suppliers', name: 'Edit Suppliers' },
        { key: 'delete_suppliers', name: 'Delete Suppliers' }
      ]
    },
    orders: {
      name: 'Order Management',
      permissions: [
        {
          key: 'view_orders',
          name: 'View Orders',
          subcategories: [
            { key: 'view_sales_orders', name: 'Sales Orders' },
            { key: 'view_purchase_orders', name: 'Purchase Orders' },
            { key: 'view_sales_invoices', name: 'Sales Invoices' },
            { key: 'view_purchase_invoices', name: 'Purchase Invoices' }
          ]
        },
        { key: 'create_orders', name: 'Create Orders' },
        { key: 'edit_orders', name: 'Edit Orders' },
        { key: 'cancel_orders', name: 'Cancel Orders' },
        { key: 'view_cost_prices', name: 'View Cost Prices' },
        // Purchase Operations - Granular
        {
          key: 'create_purchase_orders',
          name: 'Create Purchase Orders'
        },
        { key: 'edit_purchase_orders', name: 'Edit Purchase Orders' },
        { key: 'delete_purchase_orders', name: 'Delete Purchase Orders' },
        { key: 'approve_purchase_orders', name: 'Approve Purchase Orders' },
        { key: 'reject_purchase_orders', name: 'Reject Purchase Orders' },
        { key: 'receive_purchase_orders', name: 'Receive Purchase Orders' },
        { key: 'create_purchase_invoices', name: 'Create Purchase Invoices' },
        { key: 'edit_purchase_invoices', name: 'Edit Purchase Invoices' },
        { key: 'delete_purchase_invoices', name: 'Delete Purchase Invoices' },
        // Sales Operations - Granular
        { key: 'create_sales_orders', name: 'Create Sales Orders' },
        { key: 'edit_sales_orders', name: 'Edit Sales Orders' },
        { key: 'delete_sales_orders', name: 'Delete Sales Orders' },
        { key: 'approve_sales_orders', name: 'Approve Sales Orders' },
        { key: 'reject_sales_orders', name: 'Reject Sales Orders' },
        { key: 'create_sales_invoices', name: 'Create Sales Invoices' },
        { key: 'edit_sales_invoices', name: 'Edit Sales Invoices' },
        { key: 'void_sales_invoices', name: 'Void Sales Invoices' },
        { key: 'apply_discounts', name: 'Apply Discounts' },
        { key: 'override_prices', name: 'Override Prices' }
      ]
    },
    inventory: {
      name: 'Inventory Management',
      permissions: [
        {
          key: 'view_inventory',
          name: 'View Inventory',
          subcategories: [
            { key: 'view_inventory_levels', name: 'Inventory Levels' },
            { key: 'view_stock_movements', name: 'Stock Movements' },
            { key: 'view_inventory_reports', name: 'Inventory Reports' },
            { key: 'view_low_stock_alerts', name: 'Low Stock Alerts' }
          ]
        },
        {
          key: 'update_inventory',
          name: 'Update Inventory',
          subcategories: [
            { key: 'update_stock_quantities', name: 'Stock Quantities' },
            { key: 'create_stock_adjustments', name: 'Stock Adjustments' },
            { key: 'process_receipts', name: 'Process Receipts' }
          ]
        },
        // Inventory Operations - Granular
        { key: 'generate_purchase_orders', name: 'Generate Purchase Orders' },
        { key: 'acknowledge_inventory_alerts', name: 'Acknowledge Inventory Alerts' },

        { key: 'import_inventory_data', name: 'Import Inventory Data' }
      ]
    },
    returns: {
      name: 'Returns Management',
      permissions: [
        {
          key: 'view_returns',
          name: 'View Returns',
          subcategories: [
            { key: 'view_return_requests', name: 'Return Requests' },
            { key: 'view_return_history', name: 'Return History' },
            { key: 'view_return_reasons', name: 'Return Reasons' }
          ]
        },
        { key: 'create_returns', name: 'Create Returns' },
        { key: 'edit_returns', name: 'Edit Returns' },
        { key: 'approve_returns', name: 'Approve Returns' },
        { key: 'process_returns', name: 'Process Returns' }
      ]
    },
    discounts: {
      name: 'Discount Management',
      permissions: [
        {
          key: 'view_discounts',
          name: 'View Discounts',
          subcategories: [
            { key: 'view_discount_list', name: 'Discount List' },
            { key: 'view_discount_rules', name: 'Discount Rules' },
            { key: 'view_discount_history', name: 'Discount History' }
          ]
        },
        {
          key: 'manage_discounts',
          name: 'Manage Discounts',
          subcategories: [
            { key: 'create_discounts', name: 'Create Discounts' },
            { key: 'edit_discounts', name: 'Edit Discounts' },
            { key: 'delete_discounts', name: 'Delete Discounts' }
          ]
        }
      ]
    },
    reports: {
      name: 'Reports & Analytics',
      permissions: [
        {
          key: 'view_reports',
          name: 'View Reports',
          subcategories: [
            { key: 'view_pl_statements', name: 'P&L Statements' },
            { key: 'view_balance_sheets', name: 'Balance Sheets' },
            { key: 'view_sales_performance', name: 'Sales Performance' },
            { key: 'view_inventory_reports', name: 'Inventory Reports' },
            { key: 'view_general_reports', name: 'Reports' },
            { key: 'view_backdate_report', name: 'Backdate Report' }
          ]
        },
        { key: 'view_analytics', name: 'View Analytics' },
        { key: 'view_customer_analytics', name: 'Customer Analytics' },
        { key: 'view_anomaly_detection', name: 'Anomaly Detection & Fraud Prevention' },
        { key: 'view_recommendations', name: 'View Recommendations' },
        // Reports & Analytics - Granular

        { key: 'share_reports', name: 'Share Reports' },
        { key: 'schedule_reports', name: 'Schedule Reports' },
        { key: 'view_advanced_analytics', name: 'View Advanced Analytics' }
      ]
    },
    admin: {
      name: 'System Administration',
      permissions: [
        {
          key: 'manage_users',
          name: 'Manage Users',
          subcategories: [
            { key: 'create_users', name: 'Create Users' },
            { key: 'edit_users', name: 'Edit Users' },
            { key: 'delete_users', name: 'Delete Users' },
            { key: 'assign_roles', name: 'Assign Roles' }
          ]
        },
        {
          key: 'manage_settings',
          name: 'Manage Settings',
          subcategories: [
            { key: 'company_settings', name: 'Company Settings' },
            { key: 'system_settings', name: 'System Settings' },
            { key: 'print_settings', name: 'Print Settings' },
            { key: 'security_settings', name: 'Security Settings' }
          ]
        },

        // System Operations
        { key: 'view_audit_logs', name: 'View Audit Logs' },

        { key: 'import_data', name: 'Import Data' },
        { key: 'manage_integrations', name: 'Manage Integrations' },
        { key: 'configure_notifications', name: 'Configure Notifications' }
      ]
    },
    financial: {
      name: 'Financial Operations',
      permissions: [
        {
          key: 'view_cash_receipts',
          name: 'Cash Receipts',
          subcategories: [
            { key: 'view_cash_receipts', name: 'View Cash Receipts' },
            { key: 'create_cash_receipts', name: 'Create Cash Receipts' },
            { key: 'edit_cash_receipts', name: 'Edit Cash Receipts' },
            { key: 'delete_cash_receipts', name: 'Delete Cash Receipts' }
          ]
        },
        {
          key: 'view_cash_payments',
          name: 'Cash Payments',
          subcategories: [
            { key: 'view_cash_payments', name: 'View Cash Payments' },
            { key: 'create_cash_payments', name: 'Create Cash Payments' },
            { key: 'edit_cash_payments', name: 'Edit Cash Payments' },
            { key: 'delete_cash_payments', name: 'Delete Cash Payments' }
          ]
        },
        {
          key: 'view_bank_receipts',
          name: 'Bank Receipts',
          subcategories: [
            { key: 'view_bank_receipts', name: 'View Bank Receipts' },
            { key: 'create_bank_receipts', name: 'Create Bank Receipts' },
            { key: 'edit_bank_receipts', name: 'Edit Bank Receipts' },
            { key: 'delete_bank_receipts', name: 'Delete Bank Receipts' }
          ]
        },
        {
          key: 'view_bank_payments',
          name: 'Bank Payments',
          subcategories: [
            { key: 'view_bank_payments', name: 'View Bank Payments' },
            { key: 'create_bank_payments', name: 'Create Bank Payments' },
            { key: 'edit_bank_payments', name: 'Edit Bank Payments' },
            { key: 'delete_bank_payments', name: 'Delete Bank Payments' }
          ]
        },
        {
          key: 'view_expenses',
          name: 'Expenses',
          subcategories: [
            { key: 'view_expenses', name: 'View Expenses' },
            { key: 'create_expenses', name: 'Create Expenses' },
            { key: 'edit_expenses', name: 'Edit Expenses' },
            { key: 'delete_expenses', name: 'Delete Expenses' },
            { key: 'approve_expenses', name: 'Approve Expenses' }
          ]
        }
      ]
    },
    accounting: {
      name: 'Accounting',
      permissions: [
        { key: 'view_accounting_transactions', name: 'View Transactions' },
        { key: 'view_accounting_accounts', name: 'View Accounts' },
        { key: 'view_trial_balance', name: 'View Trial Balance' },
        { key: 'update_balance_sheet', name: 'Update Balance Sheet' },
        { key: 'view_chart_of_accounts', name: 'View Chart of Accounts' },
        { key: 'view_accounting_summary', name: 'View Financial Summary' }
      ]
    },
    attendance: {
      name: 'Attendance Management',
      permissions: [
        { key: 'clock_attendance', name: 'Clock Attendance' },
        { key: 'clock_in', name: 'Clock In' },
        { key: 'clock_out', name: 'Clock Out' },
        { key: 'manage_attendance_breaks', name: 'Manage Breaks' },
        { key: 'view_own_attendance', name: 'View Own Attendance' },
        { key: 'view_team_attendance', name: 'View Team Attendance' }
      ]
    },
    till: {
      name: 'Till Management',
      permissions: [
        { key: 'open_till', name: 'Open Till' },
        { key: 'close_till', name: 'Close Till' },
        { key: 'view_till', name: 'View Till' }
      ]
    },
    investors: {
      name: 'Investor Management',
      permissions: [
        { key: 'view_investors', name: 'View Investors' },
        { key: 'manage_investors', name: 'Manage Investors' },
        { key: 'create_investors', name: 'Create Investors' },
        { key: 'edit_investors', name: 'Edit Investors' },
        { key: 'payout_investors', name: 'Payout Investors' }
      ]
    }
  };

  // Default role permissions (using correct backend permission names)
  const defaultRolePermissions = {
    admin: {
      // Products
      view_products: true, create_products: true, edit_products: true, delete_products: true,
      view_product_list: true, view_product_details: true, view_product_categories: true, view_product_inventory: true,
      // Customers
      view_customers: true, create_customers: true, edit_customers: true, delete_customers: true,
      view_customer_list: true, view_customer_details: true, view_customer_history: true, view_customer_balance: true,
      // Suppliers
      view_suppliers: true, create_suppliers: true, edit_suppliers: true, delete_suppliers: true,
      view_supplier_list: true, view_supplier_details: true, view_supplier_orders: true, view_supplier_balance: true,
      // Orders
      view_orders: true, create_orders: true, edit_orders: true, cancel_orders: true,
      view_sales_orders: true, view_purchase_orders: true, view_sales_invoices: true, view_purchase_invoices: true,
      view_cost_prices: true,
      // Inventory
      view_inventory: true, update_inventory: true,
      view_inventory_levels: true, view_stock_movements: true, view_low_stock_alerts: true,
      update_stock_quantities: true, create_stock_adjustments: true, process_receipts: true,
      // Returns
      view_returns: true, create_returns: true, edit_returns: true, approve_returns: true, process_returns: true,
      view_return_requests: true, view_return_history: true, view_return_reasons: true,
      // Discounts
      view_discounts: true, manage_discounts: true,
      view_discount_list: true, view_discount_rules: true, view_discount_history: true,
      create_discounts: true, edit_discounts: true, delete_discounts: true,
      // Reports & Analytics
      view_reports: true, view_analytics: true, view_recommendations: true,
      view_pl_statements: true, view_balance_sheets: true, view_sales_performance: true,
      view_inventory_reports: true, view_general_reports: true, view_backdate_report: true,
      view_customer_analytics: true, view_anomaly_detection: true,
      share_reports: true, schedule_reports: true, view_advanced_analytics: true,
      // Financial Operations
      view_cash_receipts: true, create_cash_receipts: true, edit_cash_receipts: true, delete_cash_receipts: true,
      view_cash_payments: true, create_cash_payments: true, edit_cash_payments: true, delete_cash_payments: true,
      view_bank_receipts: true, create_bank_receipts: true, edit_bank_receipts: true, delete_bank_receipts: true,
      view_bank_payments: true, create_bank_payments: true, edit_bank_payments: true, delete_bank_payments: true,
      view_expenses: true, create_expenses: true, edit_expenses: true, delete_expenses: true, approve_expenses: true,
      // Purchase Operations - Granular
      create_purchase_orders: true, edit_purchase_orders: true, delete_purchase_orders: true,
      approve_purchase_orders: true, reject_purchase_orders: true, receive_purchase_orders: true,
      create_purchase_invoices: true, edit_purchase_invoices: true, delete_purchase_invoices: true,
      // Sales Operations - Granular
      create_sales_orders: true, edit_sales_orders: true, delete_sales_orders: true,
      approve_sales_orders: true, reject_sales_orders: true,
      create_sales_invoices: true, edit_sales_invoices: true, void_sales_invoices: true,
      apply_discounts: true, override_prices: true,
      // Inventory Operations - Granular
      generate_purchase_orders: true, acknowledge_inventory_alerts: true,
      import_inventory_data: true,
      // Accounting
      view_accounting_transactions: true, view_accounting_accounts: true, view_trial_balance: true,
      update_balance_sheet: true, view_chart_of_accounts: true, view_accounting_summary: true,
      // Attendance
      clock_attendance: true, clock_in: true, clock_out: true, manage_attendance_breaks: true,
      view_own_attendance: true, view_team_attendance: true,
      // Till Management
      open_till: true, close_till: true, view_till: true,
      // Investor Management
      view_investors: true, manage_investors: true, create_investors: true, edit_investors: true, payout_investors: true,
      // Administration
      manage_users: true, manage_settings: true,
      create_users: true, edit_users: true, delete_users: true, assign_roles: true,
      company_settings: true, system_settings: true, print_settings: true, security_settings: true,
      view_audit_logs: true, import_data: true,
      manage_integrations: true, configure_notifications: true
    },
    manager: {
      // Products - Full access except delete
      view_products: true, create_products: true, edit_products: true,
      view_product_list: true, view_product_details: true, view_product_categories: true, view_product_inventory: true,
      // Customers - Full access
      view_customers: true, create_customers: true, edit_customers: true, delete_customers: true,
      view_customer_list: true, view_customer_details: true, view_customer_history: true, view_customer_balance: true,
      // Suppliers - Full access
      view_suppliers: true, create_suppliers: true, edit_suppliers: true, delete_suppliers: true,
      view_supplier_list: true, view_supplier_details: true, view_supplier_orders: true, view_supplier_balance: true,
      // Orders - Full access
      view_orders: true, create_orders: true, edit_orders: true, cancel_orders: true,
      view_sales_orders: true, view_purchase_orders: true, view_sales_invoices: true, view_purchase_invoices: true,
      view_cost_prices: true,
      // Inventory - Full access
      view_inventory: true, update_inventory: true,
      view_inventory_levels: true, view_stock_movements: true, view_low_stock_alerts: true,
      update_stock_quantities: true, create_stock_adjustments: true, process_receipts: true,
      // Returns - Full access
      view_returns: true, create_returns: true, edit_returns: true, approve_returns: true, process_returns: true,
      view_return_requests: true, view_return_history: true, view_return_reasons: true,
      // Discounts - Full access
      view_discounts: true, manage_discounts: true,
      view_discount_list: true, view_discount_rules: true, view_discount_history: true,
      create_discounts: true, edit_discounts: true, delete_discounts: true,
      // Reports & Analytics - Full access
      view_reports: true, view_analytics: true, view_recommendations: true,
      view_pl_statements: true, view_balance_sheets: true, view_sales_performance: true,
      view_inventory_reports: true, view_general_reports: true, view_backdate_report: true,
      view_customer_analytics: true, view_anomaly_detection: true,
      share_reports: true, schedule_reports: true, view_advanced_analytics: true,
      // Financial Operations
      view_cash_receipts: true, create_cash_receipts: true, edit_cash_receipts: true, delete_cash_receipts: true,
      view_cash_payments: true, create_cash_payments: true, edit_cash_payments: true, delete_cash_payments: true,
      view_bank_receipts: true, create_bank_receipts: true, edit_bank_receipts: true, delete_bank_receipts: true,
      view_bank_payments: true, create_bank_payments: true, edit_bank_payments: true, delete_bank_payments: true,
      view_expenses: true, create_expenses: true, edit_expenses: true, delete_expenses: true, approve_expenses: true,
      // Purchase Operations - Granular
      create_purchase_orders: true, edit_purchase_orders: true, delete_purchase_orders: true,
      approve_purchase_orders: true, reject_purchase_orders: true, receive_purchase_orders: true,
      create_purchase_invoices: true, edit_purchase_invoices: true, delete_purchase_invoices: true,
      // Sales Operations - Granular
      create_sales_orders: true, edit_sales_orders: true, delete_sales_orders: true,
      approve_sales_orders: true, reject_sales_orders: true,
      create_sales_invoices: true, edit_sales_invoices: true, void_sales_invoices: true,
      apply_discounts: true, override_prices: true,
      // Inventory Operations - Granular
      generate_purchase_orders: true, acknowledge_inventory_alerts: true,
      import_inventory_data: true,
      // Accounting
      view_accounting_transactions: true, view_accounting_accounts: true, view_trial_balance: true,
      update_balance_sheet: true, view_chart_of_accounts: true, view_accounting_summary: true,
      // Attendance
      clock_attendance: true, clock_in: true, clock_out: true, manage_attendance_breaks: true,
      view_own_attendance: true, view_team_attendance: true,
      // Till Management
      open_till: true, close_till: true, view_till: true,
      // Investor Management
      view_investors: true, manage_investors: true, create_investors: true, edit_investors: true, payout_investors: true
    },
    cashier: {
      // Products - View only with basic details
      view_products: true,
      view_product_list: true, view_product_details: true,
      // Customers - View and create, limited edit
      view_customers: true, create_customers: true, edit_customers: true,
      view_customer_list: true, view_customer_details: true,
      // Orders - View and create sales orders only
      view_orders: true, create_orders: true,
      view_sales_orders: true, view_sales_invoices: true,
      // Inventory - View levels and basic movements
      view_inventory: true,
      view_inventory_levels: true, view_stock_movements: true,
      // Returns - View and process returns
      view_returns: true, process_returns: true,
      view_return_requests: true, view_return_history: true,
      // Discounts - View only
      view_discounts: true,
      view_discount_list: true,
      // Reports - Limited access
      view_reports: true,
      view_general_reports: true
    },
    viewer: {
      // Products - View only, basic details
      view_products: true,
      view_product_list: true, view_product_details: true,
      // Customers - View only, basic details
      view_customers: true,
      view_customer_list: true, view_customer_details: true,
      // Suppliers - View only, basic details
      view_suppliers: true,
      view_supplier_list: true, view_supplier_details: true,
      // Orders - View only
      view_orders: true,
      view_sales_orders: true, view_purchase_orders: true, view_sales_invoices: true, view_purchase_invoices: true,
      // Inventory - View only, basic levels
      view_inventory: true,
      view_inventory_levels: true,
      // Returns - View only
      view_returns: true,
      view_return_requests: true, view_return_history: true,
      // Discounts - View only
      view_discounts: true,
      view_discount_list: true,
      // Reports - Limited financial reports
      view_reports: true,
      view_pl_statements: true, view_balance_sheets: true, view_general_reports: true
    }
  };

  // Fetch company settings
  const { data: settingsResponse, isLoading: companyLoading, refetch: refetchSettings } = useGetCompanySettingsQuery();
  const { data: companyApiResponse } = useFetchCompanyQuery();
  const [updateCompanySettings] = useUpdateCompanySettingsMutation();
  const settings = settingsResponse?.data || settingsResponse;
  const companyProfile = companyApiResponse?.data || {};

  // Map settings data to component state
  useEffect(() => {
    if (settings) {
      const mappedData = {
        companyName: settings.companyName || '',
        address: settings.address || '',
        contactNumber: settings.contactNumber || '',
        email: settings.email || '',
        taxRegistrationNumber: settings.taxId || '' // Map taxId back to taxRegistrationNumber
      };
      setCompanyData(mappedData);

      if (settings.printSettings) {
        setPrintSettings(prev => ({
          ...prev,
          showLogo: settings.printSettings.showLogo ?? true,
          showCompanyDetails: settings.printSettings.showCompanyDetails ?? true,
          showTax: settings.printSettings.showTax ?? true,
          showDiscount: settings.printSettings.showDiscount ?? true,
          showDate: settings.printSettings.showDate ?? true,
          showFooter: settings.printSettings.showFooter ?? true,
          showEmail: settings.printSettings.showEmail ?? true,
          showCameraTime: settings.printSettings.showCameraTime ?? false,
          showDescription: settings.printSettings.showDescription ?? true,
          showProductImages: settings.printSettings.showProductImages ?? true,
          showPrintBusinessName: settings.printSettings.showPrintBusinessName ?? true,
          showPrintContactName: settings.printSettings.showPrintContactName ?? true,
          showPrintAddress: settings.printSettings.showPrintAddress ?? true,
          showPrintCity: settings.printSettings.showPrintCity ?? true,
          showPrintState: settings.printSettings.showPrintState ?? true,
          showPrintPostalCode: settings.printSettings.showPrintPostalCode ?? true,
          showPrintInvoiceNumber: settings.printSettings.showPrintInvoiceNumber ?? true,
          showPrintInvoiceDate: settings.printSettings.showPrintInvoiceDate ?? true,
          showPrintInvoiceStatus: settings.printSettings.showPrintInvoiceStatus ?? true,
          showPrintInvoiceType: settings.printSettings.showPrintInvoiceType ?? true,
          showPrintPaymentStatus: settings.printSettings.showPrintPaymentStatus ?? true,
          showPrintPaymentMethod: settings.printSettings.showPrintPaymentMethod ?? true,
          showPrintPaymentAmount: settings.printSettings.showPrintPaymentAmount ?? true,
          mobilePrintPreview: settings.printSettings.mobilePrintPreview ?? false,
          headerText: settings.printSettings.headerText || '',
          footerText: settings.printSettings.footerText || '',
          invoiceLayout: settings.printSettings.invoiceLayout || 'standard'
        }));
      }
    }
  }, [settings]);

  // Fetch users
  const { data: usersResponse, isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useGetUsersQuery(
    undefined,
    {
      onError: (error) => {
        if (error?.status === 403) {
          toast.error('Access denied. You need "manage_users" permission to view users.');
        } else if (error?.status === 401) {
          toast.error('Authentication required. Please log in again.');
        } else {
          toast.error(`Failed to load users: ${error?.data?.message || error?.message || 'Unknown error'}`);
        }
        setUsers([]);
      },
    }
  );

  // Extract users from response
  React.useEffect(() => {
    if (usersResponse) {
      let usersArray = null;

      // Primary path: data.data.users (backend structure)
      if (usersResponse?.data?.users && Array.isArray(usersResponse.data.users)) {
        usersArray = usersResponse.data.users;
      }
      // Fallback: data.users
      else if (usersResponse?.users && Array.isArray(usersResponse.users)) {
        usersArray = usersResponse.users;
      }
      // Fallback: direct array
      else if (Array.isArray(usersResponse)) {
        usersArray = usersResponse.filter(item => item._id && item.email);
      }
      // Deep search fallback
      else {
        const findUsers = (obj, depth = 0) => {
          if (depth > 5) return null;
          if (Array.isArray(obj)) {
            if (obj.length > 0 && obj[0]?._id && obj[0]?.email) {
              return obj;
            }
          }
          if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
              if (key === 'users' && Array.isArray(obj[key])) {
                return obj[key];
              }
              const result = findUsers(obj[key], depth + 1);
              if (result) return result;
            }
          }
          return null;
        };
        usersArray = findUsers(usersResponse);
      }

      if (usersArray && Array.isArray(usersArray)) {
        setUsers(usersArray);
      } else {
        setUsers([]);
      }
    }
  }, [usersResponse]);

  // Sync companyData with settings query data
  useEffect(() => {
    if (settings?.data?.data && !companyLoading) {
      setCompanyData(prev => {
        const newData = {
          companyName: settings.data.data.companyName || '',
          address: settings.data.data.address || '',
          contactNumber: settings.data.data.contactNumber || '',
          email: settings.data.data.email || '',
          taxRegistrationNumber: settings.data.data.taxId || '',
          logo: settings.data.data.logo || ''
        };

        // Only update if data has changed
        if (JSON.stringify(prev) !== JSON.stringify(newData)) {
          return newData;
        }
        return prev;
      });

      setPrintSettings(prev => {
        const ps = settings.data.data.printSettings || {};
        const newPs = {
          showLogo: ps.showLogo ?? true,
          showCompanyDetails: ps.showCompanyDetails ?? true,
          showTax: ps.showTax ?? true,
          showDiscount: ps.showDiscount ?? true,
          showDate: ps.showDate ?? true,
          showFooter: ps.showFooter ?? true,
          showEmail: ps.showEmail ?? true,
          showCameraTime: ps.showCameraTime ?? false,
          showDescription: ps.showDescription ?? true,
          showPrintBusinessName: ps.showPrintBusinessName ?? true,
          showPrintContactName: ps.showPrintContactName ?? true,
          showPrintAddress: ps.showPrintAddress ?? true,
          showPrintCity: ps.showPrintCity ?? true,
          showPrintState: ps.showPrintState ?? true,
          showPrintPostalCode: ps.showPrintPostalCode ?? true,
          showPrintInvoiceNumber: ps.showPrintInvoiceNumber ?? true,
          showPrintInvoiceDate: ps.showPrintInvoiceDate ?? true,
          showPrintInvoiceStatus: ps.showPrintInvoiceStatus ?? true,
          showPrintInvoiceType: ps.showPrintInvoiceType ?? true,
          showPrintPaymentStatus: ps.showPrintPaymentStatus ?? true,
          showPrintPaymentMethod: ps.showPrintPaymentMethod ?? true,
          showPrintPaymentAmount: ps.showPrintPaymentAmount ?? true,
          mobilePrintPreview: ps.mobilePrintPreview ?? prev.mobilePrintPreview ?? false,
          headerText: ps.headerText || prev.headerText || '',
          footerText: ps.footerText || prev.footerText || '',
          invoiceLayout: ps.invoiceLayout || prev.invoiceLayout || 'standard',
          logoSize: ps.logoSize ?? prev.logoSize ?? 100
        };

        // Only update if changed prevents verify infinite loop
        if (JSON.stringify(prev) !== JSON.stringify(newPs)) {
          return newPs;
        }
        return prev;
      });
    }
  }, [settings?.data?.data, companyLoading]);

  // Additional sync effect that triggers on component mount
  useEffect(() => {
    if (settings?.data?.data && !companyLoading) {
      const newData = {
        companyName: settings.data.data.companyName || '',
        address: settings.data.data.address || '',
        contactNumber: settings.data.data.contactNumber || '',
        email: settings.data.data.email || '',
        taxRegistrationNumber: settings.data.data.taxId || '',
        logo: settings.data.data.logo || ''
      };
      setCompanyData(newData);
    }
  }, []); // Run only on mount

  // Save company settings handler
  const handleSaveCompanySettings = async (data) => {
    setSavingCompanySettings(true);
    try {
      const response = await updateCompanySettings(data).unwrap();
      toast.success('Company information updated successfully!');

      // Update local state with saved data
      if (response?.data) {
        const updatedData = {
          companyName: response.data.companyName || '',
          address: response.data.address || '',
          contactNumber: response.data.contactNumber || '',
          email: response.data.email || '',
          taxRegistrationNumber: response.data.taxId || '', // Map taxId back to taxRegistrationNumber
          logo: response.data.logo || ''
        };
        setCompanyData(updatedData);
      }

      // Refetch settings to ensure everything is in sync
      refetchSettings();
    } catch (error) {
      handleApiError(error, 'Company Information Update');
    } finally {
      setSavingCompanySettings(false);
    }
  };

  const handleSavePrintSettings = async () => {
    setIsSavingPrintSettings(true);
    try {
      const dataToSend = {
        companyName: companyData.companyName,
        contactNumber: companyData.contactNumber,
        address: companyData.address,
        email: companyData.email,
        taxId: companyData.taxRegistrationNumber,
        printSettings: printSettings
      };

      await updateCompanySettings(dataToSend).unwrap();
      toast.success('Print settings saved successfully!');

      // Refetch to keep state in sync
      refetchSettings();
    } catch (error) {
      handleApiError(error, 'Save Print Settings');
    } finally {
      setIsSavingPrintSettings(false);
    }
  };

  // Mutations
  const [createUser, { isLoading: isCreatingUser }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdatingUser }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: isDeletingUser }] = useDeleteUserMutation();
  const [resetPassword, { isLoading: isResettingPassword }] = useResetPasswordMutation();
  const [changeMyPassword, { isLoading: isChangingMyPassword }] = useChangePasswordMutation();
  const [updateRolePermissions, { isLoading: isUpdatingRolePermissions }] = useUpdateRolePermissionsMutation();

  // User activity query
  const { data: userActivityResponse, isLoading: activityLoading, refetch: refetchActivity } = useGetUserActivityQuery(
    selectedUserActivity?.id,
    {
      skip: !selectedUserActivity?.id,
    }
  );

  React.useEffect(() => {
    if (userActivityResponse?.data) {
      setSelectedUserActivity(prev => ({ ...prev, activity: userActivityResponse.data }));
    }
  }, [userActivityResponse]);

  // Handlers
  const createUserAsync = async (userData) => {
    try {
      await createUser(userData).unwrap();
      toast.success('User created successfully!');
      resetNewUserForm();
      refetchUsers();
    } catch (error) {
      handleApiError(error, 'User Creation');
    }
  };

  const handleUpdateUser = async (id, data) => {
    try {
      await updateUser({ id, ...data }).unwrap();
      toast.success('User updated successfully!');
      setEditingUser(null);
      refetchUsers();
    } catch (error) {
      handleApiError(error, 'User Update');
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await deleteUser(id).unwrap();
      toast.success('User deleted successfully!');
      refetchUsers();
    } catch (error) {
      handleApiError(error, 'User Deletion');
    }
  };

  const handleResetPassword = async (id, newPassword) => {
    try {
      await resetPassword({ id, newPassword }).unwrap();
      toast.success('Password reset successfully!');
      setShowPasswordModal(false);
      setPasswordResetUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      handleApiError(error, 'Password Reset');
    }
  };

  // Handlers
  const handleCompanyChange = (e) => {
    const { name, value } = e.target;
    setCompanyData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCompanySubmit = (e) => {
    e.preventDefault();

    // Map frontend field names to backend field names
    const dataToSend = {
      companyName: companyData.companyName,
      contactNumber: companyData.contactNumber,
      address: companyData.address,
      email: companyData.email,
      taxId: companyData.taxRegistrationNumber // Map taxRegistrationNumber to taxId
    };

    handleSaveCompanySettings(dataToSend);
  };

  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUserData(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-apply default permissions when role changes
    if (name === 'role' && defaultRolePermissions[value]) {
      setNewUserData(prev => ({
        ...prev,
        permissions: defaultRolePermissions[value]
      }));
    }
  };

  const handleCreateUser = (e) => {
    e.preventDefault();

    // Validation
    if (!newUserData.firstName.trim()) {
      toast.error('First name is required');
      return;
    }

    if (!newUserData.lastName.trim()) {
      toast.error('Last name is required');
      return;
    }

    if (!newUserData.email.trim()) {
      toast.error('Email is required');
      return;
    }

    if (!newUserData.password.trim()) {
      toast.error('Password is required');
      return;
    }

    if (newUserData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    // Convert permissions object to array format expected by backend
    const permissionsArray = Object.keys(newUserData.permissions).filter(key => newUserData.permissions[key]);

    const userDataToSend = {
      ...newUserData,
      permissions: permissionsArray
    };

    createUserAsync(userDataToSend);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);

    // Convert permissions array to object format for the form
    const permissionsObject = {};
    if (user.permissions && Array.isArray(user.permissions)) {
      user.permissions.forEach(permission => {
        permissionsObject[permission] = true;
      });
    }

    setNewUserData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      password: '',
      role: user.role || 'cashier',
      status: user.status || 'active',
      permissions: permissionsObject
    });
  };

  const handleUpdateUserSubmit = (e) => {
    e.preventDefault();
    if (editingUser) {
      // Validation
      if (!newUserData.firstName.trim()) {
        toast.error('First name is required');
        return;
      }

      if (!newUserData.lastName.trim()) {
        toast.error('Last name is required');
        return;
      }

      if (!newUserData.email.trim()) {
        toast.error('Email is required');
        return;
      }

      // Convert permissions object to array format expected by backend
      const permissionsArray = Object.keys(newUserData.permissions).filter(key => newUserData.permissions[key]);

      // If editing own account, prevent changing role and status
      const userDataToSend = {
        firstName: newUserData.firstName,
        lastName: newUserData.lastName,
        email: newUserData.email,
        permissions: permissionsArray
      };

      // Only include role and status if NOT editing own account
      if (editingUser._id !== user?._id) {
        userDataToSend.role = newUserData.role;
        userDataToSend.status = newUserData.status;
      }

      handleUpdateUser(editingUser._id, userDataToSend);
    }
  };

  const handleDeleteUserClick = (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      handleDeleteUser(userId);
    }
  };

  const handlePermissionChange = (permissionKey, isChecked) => {
    setNewUserData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permissionKey]: isChecked
      }
    }));

    // Track role permission changes for bulk updates
    if (newUserData.role) {
      setRolePermissionsChanged(prev => ({
        ...prev,
        [newUserData.role]: {
          ...prev[newUserData.role],
          [permissionKey]: isChecked
        }
      }));
    }
  };

  const handlePrintSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPrintSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' || type === 'range' ? Number(value) : value)
    }));
  };

  const resetNewUserForm = () => {
    setNewUserData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'cashier',
      status: 'active',
      permissions: {}
    });
    setEditingUser(null);
  };

  const handlePasswordReset = () => {
    if (!newPassword.trim()) {
      toast.error('New password is required');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    const targetUser = passwordResetUser || editingUser;
    if (!targetUser?._id) {
      toast.error('User not selected');
      return;
    }

    handleResetPassword(targetUser._id, newPassword);
  };

  const handleChangeMyPassword = async () => {
    if (!currentPassword.trim()) {
      toast.error('Current password is required');
      return;
    }

    if (!newPassword.trim()) {
      toast.error('New password is required');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      await changeMyPassword({ currentPassword, newPassword }).unwrap();
      toast.success('Password changed successfully');
      setShowMyPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      handleApiError(error, 'Password Change');
    }
  };

  const openPasswordModal = (userToReset = null) => {
    // If userToReset is provided, it's for resetting another user's password
    // If null, it opens for editing the current user being edited
    if (userToReset) {
      setPasswordResetUser(userToReset);
    } else {
      // Use current editingUser if no user provided
      setPasswordResetUser(editingUser);
    }
    setShowPasswordModal(true);
    setNewPassword('');
    setConfirmPassword('');
  };

  const openMyPasswordModal = () => {
    setShowMyPasswordModal(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleUpdateRolePermissions = (role) => {
    if (!rolePermissionsChanged[role]) {
      toast.error('No permission changes detected for this role');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to update permissions for ALL users with "${role}" role? This will override their current permissions.`
    );

    if (confirmed) {
      // Get the current permissions for this role
      const currentPermissions = newUserData.permissions;
      const permissionKeys = Object.keys(currentPermissions);

      handleUpdateRolePermissions(role, permissionKeys.filter(key => currentPermissions[key]));
    }
  };

  const openActivityModal = (user) => {
    setSelectedUserActivity({
      id: user._id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role
    });
    setShowActivityModal(true);
  };

  // Sidebar Configuration State (per-link keys match MultiTabLayout / Layout SidebarItem)
  const [sidebarConfig, setSidebarConfig] = useState(() => loadSidebarConfig());

  // Load company settings on component mount
  useEffect(() => {
    refetchSettings();
  }, [refetchSettings]);

  const [accountLedgerShowReturn, setAccountLedgerShowReturn] = useState(() => {
    const saved = localStorage.getItem('accountLedgerShowReturnColumn');
    return saved === null ? true : saved === 'true';
  });

  const [showProductImagesUI, setShowProductImagesUI] = useState(() => {
    const saved = localStorage.getItem('showProductImagesUI');
    return saved === null ? true : saved === 'true';
  });

  const [showProductHsCodeColumn, setShowProductHsCodeColumn] = useState(() => {
    const saved = localStorage.getItem('showProductHsCodeColumn');
    return saved === null ? true : saved === 'true';
  });

  const tabs = [
    { id: 'company', name: 'Company Information', shortName: 'Company', icon: Building },
    { id: 'users', name: 'Users Control', shortName: 'Users', icon: Users },
    { id: 'print', name: 'Print Preview Settings', shortName: 'Print', icon: Printer },
    { id: 'other', name: 'Other', shortName: 'Other', icon: BarChart3 },
    { id: 'sidebar', name: 'Sidebar Configuration', shortName: 'Sidebar', icon: LayoutDashboard }
  ];

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide w-full">
        <nav className="-mb-px flex space-x-4 md:space-x-8 w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-2 md:px-1 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap flex-shrink-0 ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.name}</span>
                <span className="sm:hidden">{tab.shortName}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6 w-full overflow-x-hidden">
        {/* Company Information Tab */}
        {activeTab === 'company' && (
          <div className="card">
            <div className="card-header">
              <div className="flex items-center space-x-2">
                <Building className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Company Information</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Manage your company details and branding information
              </p>
            </div>

            <div className="card-content">
              <CompanySettingsForm />
            </div>
          </div>
        )}


        {/* Users Control Tab */}
        {activeTab === 'users' && (
          <div className="space-y-8 max-w-full mx-auto">
            {/* Users List Card */}
            <div className="bg-white border text-gray-900 shadow-sm border-gray-200 rounded-2xl overflow-hidden relative">
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-gray-900 text-white rounded-xl shadow-sm">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">System Users ({users.length})</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Manage existing team members, system access, and individual permissions.
                    </p>
                  </div>
                </div>
                <div className="mt-4 sm:mt-0 flex gap-2">
                  <Button
                    onClick={() => {
                      resetNewUserForm();
                      const form = document.getElementById('add-edit-user-form');
                      if (form) {
                        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(() => {
                          const firstInput = form.querySelector('input[type="text"]');
                          if (firstInput) {
                            firstInput.focus();
                          }
                        }, 300);
                      }
                    }}
                    className="bg-gray-900 text-white hover:bg-gray-800 shadow-md transition-all rounded-lg px-5 py-2.5 h-auto text-sm font-medium"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New User
                  </Button>
                </div>
              </div>

              <div className="p-0">
                {usersLoading ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner />
                  </div>
                ) : usersError ? (
                  <div className="text-center py-12">
                    <div className="bg-red-50 border border-red-100 rounded-xl p-6 max-w-md mx-auto shadow-sm">
                      <div className="flex items-center justify-center mb-4">
                        <div className="p-3 bg-red-100 text-red-600 rounded-full">
                          <X className="h-8 w-8" />
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-red-900 mb-2">Failed to Load Users</h3>
                      <p className="text-sm text-red-700 mb-6 font-medium">
                        {usersError.response?.status === 403
                          ? 'You need "manage_users" permission to view users. Please contact an administrator.'
                          : usersError.response?.status === 401
                            ? 'Authentication required. Please refresh the page and log in again.'
                            : usersError.message || 'An error occurred while loading users.'}
                      </p>
                      <Button onClick={() => refetchUsers()} variant="outline" className="bg-white hover:bg-red-50 border-red-200 text-red-700 font-semibold px-6 py-2 rounded-lg transition-colors">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try Again
                      </Button>
                    </div>
                  </div>
                ) : users.length > 0 ? (
                  <ul className="divide-y divide-gray-100">
                    {users.map((systemUser) => (
                      <li
                        key={systemUser._id}
                        className="group flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 hover:bg-gray-50/80 transition-all duration-200"
                      >
                        <div className="flex items-center space-x-5 flex-1 min-w-0">
                          {/* Avatar */}
                          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xl shadow-sm ${
                            systemUser.role === 'admin' ? 'bg-gradient-to-br from-gray-700 to-gray-900' :
                            systemUser.role === 'manager' ? 'bg-gradient-to-br from-blue-500 to-blue-700' :
                            'bg-gradient-to-br from-emerald-400 to-emerald-600'
                          }`}>
                            {systemUser.firstName?.charAt(0) || ''}{systemUser.lastName?.charAt(0) || ''}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                              <p className="text-base font-bold text-gray-900 truncate tracking-tight">
                                {systemUser.firstName} {systemUser.lastName}
                              </p>
                              {systemUser._id === user?._id && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 tracking-wider uppercase border border-indigo-100 shadow-sm">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5 truncate font-medium flex items-center gap-1.5">
                              {systemUser.email}
                            </p>
                            
                            <div className="flex flex-wrap items-center gap-2 mt-2.5">
                              {/* Role Badge */}
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm border ${
                                systemUser.role === 'admin' ? 'bg-gray-900 text-white border-gray-900' :
                                systemUser.role === 'manager' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                systemUser.role === 'cashier' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                'bg-gray-50 text-gray-700 border-gray-200'
                              }`}>
                                <Shield className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                                {systemUser.role.charAt(0).toUpperCase() + systemUser.role.slice(1)}
                              </span>

                              {/* Status Badge */}
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm border ${
                                systemUser.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${systemUser.status === 'active' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                                {systemUser.status === 'active' ? 'Active' : 'Inactive'}
                              </span>
                              
                              {systemUser.loginCount > 0 && (
                                <span className="text-xs text-gray-400 font-medium ml-2 px-2 border-l border-gray-200">
                                  {systemUser.loginCount} logins
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 sm:mt-0 flex flex-nowrap items-center gap-2.5 flex-shrink-0 opacity-100 lg:opacity-60 group-hover:opacity-100 transition-opacity">
                          <Button variant="outline" size="sm" onClick={() => openActivityModal(systemUser)} title="Activity Logs" className="h-10 w-10 p-0 rounded-xl hover:bg-gray-900 hover:text-white hover:border-gray-900 shadow-sm">
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openPasswordModal(systemUser)} title="Reset Password" className="h-10 w-10 p-0 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 shadow-sm border-gray-200">
                            <Lock className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEditUser(systemUser)} title="Edit Configuration" className="h-10 w-10 p-0 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 shadow-sm border-gray-200">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteUserClick(systemUser._id)} disabled={systemUser._id === user?._id} title="Delete User" className="h-10 w-10 p-0 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-40 shadow-sm border-gray-200">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-16 px-4">
                    <div className="bg-gray-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-gray-200">
                      <Users className="h-10 w-10 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">No Users Found</h3>
                    <p className="text-gray-500 mb-8 max-w-sm mx-auto font-medium">
                      The system doesn't have any users assigned yet. Start by inviting a new team member below.
                    </p>
                    <Button
                      onClick={() => {
                        const form = document.getElementById('add-edit-user-form');
                        if (form) {
                          form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          setTimeout(() => form.querySelector('input[type="text"]')?.focus(), 300);
                        }
                      }}
                      className="bg-gray-900 text-white hover:bg-gray-800 rounded-xl px-6 py-2.5 h-auto font-semibold shadow-md"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Create First User
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Add/Edit User Form */}
            <div id="add-edit-user-form" className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden relative mt-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-900"></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 md:p-8 border-b border-gray-100 bg-white">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gray-100 text-gray-900 rounded-xl shadow-sm">
                    {editingUser ? <UserCheck className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                      {editingUser ? 'Edit Member Profile' : 'Add New Member'}
                    </h2>
                    <p className="text-sm font-medium text-gray-500 mt-1">
                      {editingUser ? 'Modify credentials, roles, and fine-grained permissions.' : 'Create a new user access profile and designate system permissions.'}
                    </p>
                  </div>
                </div>
                {editingUser && (
                  <Button
                    onClick={resetNewUserForm}
                    variant="outline"
                    className="mt-4 sm:mt-0 font-semibold px-4 shadow-sm rounded-lg hover:border-gray-900"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel Edit
                  </Button>
                )}
              </div>

              <div className="p-6 md:p-8 bg-gray-50/30">
                <form key={editingUser?._id || 'new-user'} onSubmit={editingUser ? handleUpdateUserSubmit : handleCreateUser} className="space-y-8">
                  
                  {/* Row 1: Profile Information container */}
                  <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-md font-bold text-gray-900 border-b border-gray-100 pb-4 mb-6 flex items-center">
                      <User className="h-5 w-5 mr-2 text-gray-500" />
                      Profile Details
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      {/* First Name */}
                      <div className="group">
                        <label className="block text-sm font-semibold text-gray-900 mb-2 group-focus-within:text-blue-600 transition-colors">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          type="text"
                          name="firstName"
                          value={newUserData.firstName}
                          onChange={handleNewUserChange}
                          placeholder="e.g. John"
                          autoComplete="off"
                          required
                          className="h-11 rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-all shadow-sm"
                        />
                      </div>

                      {/* Last Name */}
                      <div className="group">
                        <label className="block text-sm font-semibold text-gray-900 mb-2 group-focus-within:text-blue-600 transition-colors">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          type="text"
                          name="lastName"
                          value={newUserData.lastName}
                          onChange={handleNewUserChange}
                          placeholder="e.g. Doe"
                          autoComplete="off"
                          required
                          className="h-11 rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-all shadow-sm"
                        />
                      </div>

                      {/* Email */}
                      <div className="group">
                        <label className="block text-sm font-semibold text-gray-900 mb-2 group-focus-within:text-blue-600 transition-colors">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Mail className="h-4 w-4 text-gray-400" />
                          </div>
                          <Input
                            type="email"
                            name="email"
                            value={newUserData.email}
                            onChange={handleNewUserChange}
                            placeholder="john.doe@company.com"
                            autoComplete="off"
                            required
                            className="h-11 pl-10 rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-all shadow-sm"
                          />
                        </div>
                      </div>

                      {/* Password / Change Auth */}
                      {!editingUser ? (
                        <div className="group">
                          <label className="block text-sm font-semibold text-gray-900 mb-2 group-focus-within:text-blue-600 transition-colors">
                            Initial Password <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                              <Lock className="h-4 w-4 text-gray-400" />
                            </div>
                            <Input
                              type={showNewUserPassword ? 'text' : 'password'}
                              name="password"
                              value={newUserData.password}
                              onChange={handleNewUserChange}
                              className="h-11 pl-10 pr-10 rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-all shadow-sm"
                              placeholder="Minimum 6 characters"
                              autoComplete="new-password"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                              className="absolute inset-y-0 right-0 pr-3.5 flex items-center hover:text-blue-600 transition-colors"
                            >
                              {showNewUserPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-500" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-500" />
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="group">
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Security Credentials
                          </label>
                          <Button
                            type="button"
                            onClick={() => openPasswordModal()}
                            variant="outline"
                            className="w-full h-11 rounded-xl shadow-sm border-gray-200 font-semibold border hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-all justify-start"
                          >
                            <Lock className="h-4 w-4 mr-3 text-indigo-500" />
                            Force Password Reset
                          </Button>
                          <p className="text-xs font-semibold text-gray-400 mt-2 ml-1">
                            Sends an update overlay to change this user's password immediately.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Access Configuration container */}
                  <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="text-md font-bold text-gray-900 border-b border-gray-200 pb-4 mb-6 flex items-center">
                      <Shield className="h-5 w-5 mr-2 text-indigo-500" />
                      Access & Authorizations
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Role selection */}
                      <div className="flex flex-col space-y-2">
                        <label className="text-sm font-semibold text-gray-900">
                          Template Role <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="role"
                          value={newUserData.role}
                          onChange={handleNewUserChange}
                          className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium shadow-sm transition-all appearance-none cursor-pointer"
                          required
                          disabled={editingUser && editingUser._id === user?._id}
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundPosition: 'right 0.75rem center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '1.5em 1.5em',
                            paddingRight: '2.5rem'
                          }}
                        >
                          <option value="cashier">Cashier — Daily point of sale ops</option>
                          <option value="manager">Manager — Full back-office operations</option>
                          <option value="inventory">Inventory — Manage stock & ledgers</option>
                          <option value="admin">Administrator — Full uninhibited access</option>
                          <option value="viewer">Viewer — Readonly reporting access</option>
                        </select>
                        <span className="text-xs font-semibold text-gray-500 mt-1 pl-1">
                          {editingUser && editingUser._id === user?._id
                            ? 'LOCKED: You cannot change your own authorization level.'
                            : 'Selecting a role automatically ticks default required permissions.'}
                        </span>

                        {rolePermissionsChanged[newUserData.role] && (
                          <div className="mt-4 p-4 bg-orange-50/80 border border-orange-200 rounded-xl shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                            <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row pl-2">
                              <div>
                                <h4 className="text-sm font-bold text-orange-900 flex items-center">
                                  <AlertCircle className="w-4 h-4 mr-1.5" /> Overrides Detected
                                </h4>
                                <p className="text-xs font-semibold text-orange-700 mt-1">
                                  You altered <strong>{newUserData.role}</strong> baseline defaults.
                                </p>
                              </div>
                              <Button
                                type="button"
                                onClick={() => handleUpdateRolePermissions(newUserData.role)}
                                disabled={isUpdatingRolePermissions}
                                className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-9 text-xs rounded-lg shadow-sm whitespace-nowrap px-4"
                              >
                                {isUpdatingRolePermissions ? (
                                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                ) : (
                                  <Users className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                Push to all {newUserData.role}s
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Status toggle */}
                      <div className="flex flex-col space-y-3">
                        <label className="text-sm font-semibold text-gray-900">
                          Account Status
                        </label>
                        <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200 w-full sm:w-fit cursor-pointer shadow-inner">
                          <label className={`flex-1 sm:w-28 flex items-center justify-center py-2.5 px-3 rounded-lg text-sm font-bold cursor-pointer transition-all ${newUserData.status === 'active' ? 'bg-white text-green-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`} style={{
                            opacity: (editingUser && editingUser._id === user?._id) ? 0.6 : 1, pointerEvents: (editingUser && editingUser._id === user?._id) ? 'none' : 'auto'
                          }}>
                            <input
                              type="radio"
                              name="status"
                              value="active"
                              checked={newUserData.status === 'active'}
                              onChange={handleNewUserChange}
                              className="sr-only"
                              disabled={editingUser && editingUser._id === user?._id}
                            />
                            <div className={`w-2 h-2 rounded-full mr-2 ${newUserData.status === 'active' ? 'bg-green-500' : 'bg-transparent'}`}></div>
                            Active
                          </label>
                          <label className={`flex-1 sm:w-28 flex items-center justify-center py-2.5 px-3 rounded-lg text-sm font-bold cursor-pointer transition-all ${newUserData.status === 'inactive' ? 'bg-white text-red-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`} style={{
                            opacity: (editingUser && editingUser._id === user?._id) ? 0.6 : 1, pointerEvents: (editingUser && editingUser._id === user?._id) ? 'none' : 'auto'
                          }}>
                            <input
                              type="radio"
                              name="status"
                              value="inactive"
                              checked={newUserData.status === 'inactive'}
                              onChange={handleNewUserChange}
                              className="sr-only"
                              disabled={editingUser && editingUser._id === user?._id}
                            />
                            <div className={`w-2 h-2 rounded-full mr-2 ${newUserData.status === 'inactive' ? 'bg-red-500' : 'bg-transparent'}`}></div>
                            Suspended
                          </label>
                        </div>
                        {editingUser && editingUser._id === user?._id && (
                          <span className="text-xs font-semibold text-gray-500">
                            You cannot suspend your own active session.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Permissions Big Block */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row items-baseline justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                          <Check className="h-5 w-5 text-green-600" />
                          Granular Permissions Matrix
                        </h3>
                        <p className="text-sm font-medium text-gray-500 mt-1">
                          Fine-tune exactly what functionalities this user has rights to interact with globally.
                        </p>
                      </div>
                      <div className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm whitespace-nowrap">
                        {Object.keys(newUserData.permissions || {}).filter(k=>newUserData.permissions[k]).length} Allowed Rules
                      </div>
                    </div>

                    {editingUser && editingUser._id === user?._id ? (
                      <div className="p-10 text-center bg-gray-50 border-t border-dashed border-gray-200">
                        <div className="inline-flex bg-gray-900 text-white rounded-full p-4 mb-4 shadow-md">
                          <Lock className="w-8 h-8" />
                        </div>
                        <h4 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">Security Lock Engaged</h4>
                        <p className="text-base text-gray-600 max-w-lg mx-auto font-medium">
                          You cannot modify your own granular authorization policies. This safeguard guarantees administrators cannot accidentally revoke their own access.
                        </p>
                      </div>
                    ) : (
                      <div className="p-6 md:p-8 bg-gray-50/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {Object.entries(permissionCategories).map(([categoryKey, category]) => {
                            // Check if all permissions in category are active to show a nice global indicator
                            const totalPerms = category.permissions.length + category.permissions.reduce((acc, p) => acc + (p.subcategories?.length || 0), 0);
                            const activePermsCount = category.permissions.filter(p => newUserData.permissions[p.key]).length + 
                                                   category.permissions.reduce((acc, p) => acc + (p.subcategories?.filter(s => newUserData.permissions[s.key]).length || 0), 0);
                            const percentActive = totalPerms > 0 ? (activePermsCount / totalPerms) : 0;
                            
                            return (
                              <div key={categoryKey} className="bg-white border border-gray-200 hover:border-blue-300 rounded-xl overflow-hidden shadow-sm hover:shadow transition-all duration-300 pb-2">
                                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
                                  <h4 className="font-bold text-gray-900 text-sm tracking-tight">{category.name}</h4>
                                  <div className="flex bg-gray-200 rounded-full h-1.5 w-12 overflow-hidden shadow-inner">
                                    <div className={`h-full ${percentActive > 0.8 ? 'bg-green-500' : percentActive > 0 ? 'bg-blue-500' : 'bg-transparent'}`} style={{ width: `${percentActive * 100}%` }}></div>
                                  </div>
                                </div>
                                <div className="p-3 space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                                  {category.permissions.map((permission) => (
                                    <div key={permission.key} className="relative">
                                      <label className="flex items-start space-x-3 py-2 px-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                                        <div className="flex items-center h-5 mt-0.5">
                                          <input
                                            type="checkbox"
                                            checked={newUserData.permissions[permission.key] || false}
                                            onChange={(e) => handlePermissionChange(permission.key, e.target.checked)}
                                            className="w-4 h-4 rounded border-2 border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 transition-all checked:border-blue-600 cursor-pointer"
                                          />
                                        </div>
                                        <span className={`text-sm font-bold truncate transition-colors ${newUserData.permissions[permission.key] ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-900'}`}>
                                          {permission.name}
                                        </span>
                                      </label>
                                      
                                      {permission.subcategories && permission.subcategories.length > 0 && (
                                        <div className="ml-7 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3 pt-1 pb-2">
                                          {permission.subcategories.map((subcategory, index) => (
                                            <label key={subcategory.key || index} className="flex items-start space-x-2 py-1.5 px-2 hover:bg-blue-50 rounded-md cursor-pointer transition-colors group">
                                              <div className="flex items-center h-4 mt-0.5">
                                                <input
                                                  type="checkbox"
                                                  checked={newUserData.permissions[subcategory.key] || false}
                                                  onChange={(e) => handlePermissionChange(subcategory.key, e.target.checked)}
                                                  className="w-3.5 h-3.5 rounded border border-gray-300 text-blue-500 focus:ring-blue-500 opacity-80 checked:opacity-100 transition-all cursor-pointer"
                                                />
                                              </div>
                                              <span className={`text-xs font-semibold truncate transition-colors ${newUserData.permissions[subcategory.key] ? 'text-gray-800' : 'text-gray-500 group-hover:text-gray-700'}`}>
                                                {subcategory.name}
                                              </span>
                                            </label>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submission Footer */}
                  <div className="flex justify-end items-center pt-6 px-2 gap-4">
                    {editingUser && (
                      <span className="text-sm font-semibold text-gray-500 mr-auto">
                        Make sure to review changes before committing.
                      </span>
                    )}
                    <LoadingButton
                      type="submit"
                      isLoading={editingUser ? isUpdatingUser : isCreatingUser}
                      variant="default"
                      className="bg-gray-900 text-white hover:bg-gray-800 hover:shadow-lg rounded-xl px-10 py-3.5 h-auto text-base font-bold transition-all"
                    >
                      {editingUser ? (
                        <>
                          <Save className="h-5 w-5 mr-2" />
                          Commit Changes
                        </>
                      ) : (
                        <>
                          <Check className="h-5 w-5 mr-2" />
                          Finalize & Create Member
                        </>
                      )}
                    </LoadingButton>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Print Preview Settings Tab */}
        {activeTab === 'print' && (
          <div className="card">
            <div className="card-header">
              <div className="flex items-center space-x-2">
                <Printer className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Print Preview Settings</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Customize how your invoices and receipts appear when printed
              </p>
            </div>

            <div className="card-content">
              <div className="space-y-6">
                {/* Layout Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Invoice/Sale Receipt Layout
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="invoiceLayout"
                        value="standard"
                        checked={printSettings.invoiceLayout === 'standard'}
                        onChange={handlePrintSettingsChange}
                        className="mr-3"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Standard</div>
                        <div className="text-xs text-gray-500">Basic layout with company info</div>
                      </div>
                    </label>
                    <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="invoiceLayout"
                        value="compact"
                        checked={printSettings.invoiceLayout === 'compact'}
                        onChange={handlePrintSettingsChange}
                        className="mr-3"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Compact</div>
                        <div className="text-xs text-gray-500">Condensed layout for small receipts</div>
                      </div>
                    </label>
                    <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="invoiceLayout"
                        value="detailed"
                        checked={printSettings.invoiceLayout === 'detailed'}
                        onChange={handlePrintSettingsChange}
                        className="mr-3"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Detailed</div>
                        <div className="text-xs text-gray-500">Full layout with all information</div>
                      </div>
                    </label>
                    <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="invoiceLayout"
                        value="layout2"
                        checked={printSettings.invoiceLayout === 'layout2'}
                        onChange={handlePrintSettingsChange}
                        className="mr-3"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Layout 2 (Professional)</div>
                        <div className="text-xs text-gray-500">Boxed layout with totals summary</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Header and Footer Customization - Hidden for Layout 2 */}
                {printSettings.invoiceLayout !== 'layout2' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Header Text (Optional)
                      </label>
                      <Textarea
                        name="headerText"
                        value={printSettings.headerText}
                        onChange={handlePrintSettingsChange}
                        placeholder="Enter custom header text"
                        rows={3}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This text will appear at the top of printed documents
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Footer Text (Optional)
                      </label>
                      <Textarea
                        name="footerText"
                        value={printSettings.footerText}
                        onChange={handlePrintSettingsChange}
                        placeholder="Enter custom footer text"
                        rows={3}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This text will appear at the bottom of printed documents
                      </p>
                    </div>
                  </div>
                )}

                {/* Display Options - these apply to all print previews and printed documents (Sales/Purchase Invoice, Sales/Purchase Order) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Display Options
                  </label>
                  <p className="text-xs text-gray-500 mb-6">
                    Control what appears on printed invoices and receipts. Uncheck to hide elements anywhere print is used.
                  </p>

                  <div className="space-y-8">
                    {/* General Header Section */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
                        <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><Printer className="h-4 w-4" /></div>
                        <h4 className="text-sm font-bold text-gray-700">General Header & Layout</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Logo Size Control (Special) */}
                        <div className="col-span-1 sm:col-span-2 p-4 border border-blue-100 rounded-xl bg-blue-50/20 shadow-sm flex flex-col space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                              Logo Scale
                            </div>
                            <div className="text-xs font-black text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">{printSettings.logoSize || 100}px</div>
                          </div>
                          <input
                            type="range"
                            name="logoSize"
                            min="30"
                            max="350"
                            step="5"
                            value={printSettings.logoSize || 100}
                            onChange={handlePrintSettingsChange}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                          <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                            <span>Min</span>
                            <span>Balanced</span>
                            <span>Max</span>
                          </div>
                        </div>

                        {/* Standard Toggle Boxes */}
                        {[
                          { id: 'showLogo', label: 'Display Logo', icon: <Printer className="h-3.5 w-3.5" /> },
                          { id: 'showCompanyDetails', label: 'Company Header', icon: <Building className="h-3.5 w-3.5" />, hidden: printSettings.invoiceLayout === 'layout2' },
                          { id: 'showEmail', label: 'Show Email', icon: <Mail className="h-3.5 w-3.5" /> },
                          { id: 'showFooter', label: 'Show Footer', icon: <FileText className="h-3.5 w-3.5" /> },
                          { id: 'mobilePrintPreview', label: 'Mobile View', icon: <Eye className="h-3.5 w-3.5" /> },
                          { id: 'showDate', label: 'Doc Date', icon: <Clock className="h-3.5 w-3.5" /> },
                        ].map(item => !item.hidden && (
                          <div key={item.id} className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
                            <Checkbox
                              id={item.id}
                              className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              checked={printSettings[item.id]}
                              onCheckedChange={(checked) => handlePrintSettingsChange({ target: { name: item.id, type: 'checkbox', checked } })}
                            />
                            <Label htmlFor={item.id} className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer group-hover:text-blue-700">
                              <div className="p-1.5 bg-gray-50 rounded-lg text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">{item.icon}</div>
                              {item.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Table & Financial Details Section */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
                        <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><BarChart3 className="h-4 w-4" /></div>
                        <h4 className="text-sm font-bold text-gray-700">Financials & Table Info</h4>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { id: 'showTax', label: 'Tax Breakdown' },
                          { id: 'showDiscount', label: 'Discounts' },
                          { id: 'showDescription', label: 'Item Desc' },
                          { id: 'showCameraTime', label: 'Cam Timestamp' },
                        ].map(item => (
                          <div key={item.id} className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-emerald-300 hover:shadow-md transition-all duration-200 group">
                            <Checkbox
                              id={item.id}
                              className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                              checked={printSettings[item.id]}
                              onCheckedChange={(checked) => handlePrintSettingsChange({ target: { name: item.id, type: 'checkbox', checked } })}
                            />
                            <Label htmlFor={item.id} className="text-sm font-semibold text-gray-700 cursor-pointer group-hover:text-emerald-700">
                              {item.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Party Details Section */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
                        <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600"><Users className="h-4 w-4" /></div>
                        <h4 className="text-sm font-bold text-gray-700">Party / Billing Details</h4>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { id: 'showPrintBusinessName', label: 'Business Name' },
                          { id: 'showPrintContactName', label: 'Contact Name' },
                          { id: 'showPrintAddress', label: 'Full Address' },
                          { id: 'showPrintCity', label: 'City' },
                          { id: 'showPrintState', label: 'State / Prov' },
                          { id: 'showPrintPostalCode', label: 'Postal Code' },
                        ].map(item => (
                          <div key={item.id} className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-amber-300 hover:shadow-md transition-all duration-200 group">
                            <Checkbox
                              id={item.id}
                              className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                              checked={printSettings[item.id]}
                              onCheckedChange={(checked) => handlePrintSettingsChange({ target: { name: item.id, type: 'checkbox', checked } })}
                            />
                            <Label htmlFor={item.id} className="text-sm font-semibold text-gray-700 cursor-pointer group-hover:text-amber-700">
                              {item.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Invoice Meta Section */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
                        <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><FileText className="h-4 w-4" /></div>
                        <h4 className="text-sm font-bold text-gray-700">Invoice Meta & Payment</h4>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { id: 'showPrintInvoiceNumber', label: 'Invoice #' },
                          { id: 'showPrintInvoiceDate', label: 'Inv Date' },
                          { id: 'showPrintInvoiceStatus', label: 'Doc Status' },
                          { id: 'showPrintInvoiceType', label: 'Doc Type' },
                          { id: 'showPrintPaymentStatus', label: 'Pay Status' },
                          { id: 'showPrintPaymentMethod', label: 'Pay Method' },
                          { id: 'showPrintPaymentAmount', label: 'Pay Amount' },
                        ].map(item => (
                          <div key={item.id} className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200 group">
                            <Checkbox
                              id={item.id}
                              className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                              checked={printSettings[item.id]}
                              onCheckedChange={(checked) => handlePrintSettingsChange({ target: { name: item.id, type: 'checkbox', checked } })}
                            />
                            <Label htmlFor={item.id} className="text-sm font-semibold text-gray-700 cursor-pointer group-hover:text-indigo-700">
                              {item.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Print Preview */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Print Preview
                  </label>
                  <p className="text-xs text-gray-500 mb-4">
                    This preview shows how your receipts will appear with the actual saved company information.
                    {(!companyData.companyName && !companyData.address && !companyData.contactNumber) && (
                      <span className="text-orange-600 font-medium"> Please save your company information first to see the preview.</span>
                    )}
                  </p>
                  <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 md:p-8 overflow-auto flex justify-center items-start min-h-[500px] max-h-[800px] shadow-inner">
                    <div
                      style={
                        printSettings.mobilePrintPreview
                          ? { maxWidth: 420, width: '100%', transform: 'scale(0.9)', transformOrigin: 'top center', marginBottom: '-100px' }
                          : { transform: 'scale(0.6)', transformOrigin: 'top center', marginBottom: '-400px', width: '900px' }
                      }
                      className="transition-transform duration-300 ease-in-out"
                    >
                      <PrintDocument
                        companySettings={{ ...companyData, logo: companyProfile.logo || companyData.logo }}
                        orderData={sampleOrderData}
                        printSettings={printSettings}
                        documentTitle="Receipt Preview"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t">
                  <LoadingButton
                    type="button"
                    isLoading={isSavingPrintSettings}
                    onClick={(e) => {
                      e.preventDefault();
                      handleSavePrintSettings();
                    }}
                    variant="default"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Print Settings
                  </LoadingButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other Tab */}
        {activeTab === 'other' && (
          <div className="card">
            <div className="card-header">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Other Settings</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Display options and miscellaneous settings
              </p>
            </div>
            <div className="card-content">
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Show Product Images */}
                  <div className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
                    <Checkbox
                      id="showProductImagesUI"
                      className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      checked={showProductImagesUI}
                      onCheckedChange={(checked) => {
                        setShowProductImagesUI(checked);
                        localStorage.setItem('showProductImagesUI', String(checked));
                        toast.success(`Product images ${checked ? 'shown' : 'hidden'} in UI tables`);
                        window.dispatchEvent(new Event('productImagesConfigChanged'));
                      }}
                    />
                    <Label htmlFor="showProductImagesUI" className="flex flex-col cursor-pointer group-hover:text-blue-700">
                      <span className="text-sm font-semibold">Show Product Images</span>
                      <span className="text-[10px] text-gray-400">Thumbnails in lists & POS</span>
                    </Label>
                  </div>

                  {/* Show HS Code */}
                  <div className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
                    <Checkbox
                      id="showProductHsCodeColumn"
                      className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      checked={showProductHsCodeColumn}
                      onCheckedChange={(checked) => {
                        setShowProductHsCodeColumn(checked);
                        localStorage.setItem('showProductHsCodeColumn', String(checked));
                        toast.success(`HS Code column ${checked ? 'shown' : 'hidden'} on Products list`);
                        window.dispatchEvent(new Event('productHsCodeColumnConfigChanged'));
                      }}
                    />
                    <Label htmlFor="showProductHsCodeColumn" className="flex flex-col cursor-pointer group-hover:text-blue-700">
                      <span className="text-sm font-semibold">Show HS Code Column</span>
                      <span className="text-[10px] text-gray-400">Include in product lists</span>
                    </Label>
                  </div>

                  {/* Show Return Column */}
                  <div className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
                    <Checkbox
                      id="accountLedgerShowReturn"
                      className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      checked={accountLedgerShowReturn}
                      onCheckedChange={(checked) => {
                        setAccountLedgerShowReturn(checked);
                        localStorage.setItem('accountLedgerShowReturnColumn', String(checked));
                        toast.success(`Return column ${checked ? 'shown' : 'hidden'} in Account Ledger Summary`);
                        window.dispatchEvent(new Event('accountLedgerConfigChanged'));
                      }}
                    />
                    <Label htmlFor="accountLedgerShowReturn" className="flex flex-col cursor-pointer group-hover:text-blue-700">
                      <span className="text-sm font-semibold">Show Ledger Return</span>
                      <span className="text-[10px] text-gray-400">Column in Ledger Summary</span>
                    </Label>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <OrderItemWiseConfirmationSettings />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar Configuration Tab */}
        {activeTab === 'sidebar' && (
          <div className="card shadow-lg border-gray-100">
            <div className="card-header border-b border-gray-50 pb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 shadow-sm">
                  <LayoutDashboard className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 leading-tight">Sidebar Configuration</h2>
                  <p className="text-sm text-gray-500 mt-1 font-medium">
                    Tailor your navigation experience by enabling or disabling specific modules.
                  </p>
                </div>
              </div>
            </div>
            <div className="card-content p-6">
              <div className="space-y-12">
                {/* Organize by Headings */}
                {navigation.reduce((acc, current) => {
                  if (current.type === 'heading') {
                    acc.push({ heading: current, items: [] });
                  } else if (current.name) {
                    if (acc.length === 0) {
                      acc.push({ heading: { name: 'General' }, items: [current] });
                    } else {
                      acc[acc.length - 1].items.push(current);
                    }
                  }
                  return acc;
                }, []).map((section, sIdx) => (
                  <div key={sIdx} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full border shadow-sm ${section.heading.color || 'bg-gray-50 text-gray-500 border-gray-100'} ${section.heading.color ? 'text-white border-transparent' : ''}`}>
                        {section.heading.name}
                      </h3>
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-gray-100 to-transparent"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {section.items.map((item) => {
                        const hasChildren = item.children && item.children.length > 0;
                        if (hasChildren) {
                          return (
                            <div
                              key={item.name}
                              className="col-span-1 sm:col-span-2 lg:col-span-4 rounded-2xl border border-gray-200/60 bg-gray-50/40 p-6 space-y-5"
                            >
                              <div className="flex items-center justify-between border-b border-gray-200/50 pb-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100">
                                    {item.icon && <item.icon className="h-4 w-4 text-indigo-500 flex-shrink-0" />}
                                  </div>
                                  <span className="text-sm font-bold text-gray-800 uppercase tracking-tight">{item.name}</span>
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter bg-gray-100/50 px-2 py-0.5 rounded">Module Links</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {item.children.map((child) => {
                                  const childId = `sidebar-${section.heading.name}-${item.name}-${child.name}`.replace(/\s+/g, '-');
                                  return (
                                    <div
                                      key={child.name}
                                      className="flex items-center space-x-3 p-3.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all duration-300 group"
                                    >
                                      <Checkbox
                                        id={childId}
                                        checked={sidebarConfig[child.name] !== false}
                                        onCheckedChange={(checked) => {
                                          const newConfig = { ...sidebarConfig, [child.name]: checked };
                                          setSidebarConfig(newConfig);
                                          localStorage.setItem('sidebarConfig', JSON.stringify(newConfig));
                                          toast.success(`${child.name} ${checked ? 'shown' : 'hidden'} in sidebar`);
                                          window.dispatchEvent(new Event('sidebarConfigChanged'));
                                        }}
                                        className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 transition-colors"
                                      />
                                      <Label
                                        htmlFor={childId}
                                        className="text-xs font-bold text-gray-600 cursor-pointer flex-1 flex items-center min-w-0 group-hover:text-indigo-800"
                                      >
                                        {child.icon && <child.icon className="h-4 w-4 mr-2 text-gray-400 group-hover:text-indigo-500 flex-shrink-0 transition-colors" />}
                                        <span className="truncate">{child.name}</span>
                                      </Label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        const singleId = `sidebar-${item.name}`.replace(/\s+/g, '-');
                        return (
                          <div
                            key={item.name}
                            className="flex items-center space-x-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-indigo-400 hover:shadow-lg transition-all duration-300 group"
                          >
                            <Checkbox
                              id={singleId}
                              checked={sidebarConfig[item.name] !== false}
                              onCheckedChange={(checked) => {
                                const newConfig = { ...sidebarConfig, [item.name]: checked };
                                setSidebarConfig(newConfig);
                                localStorage.setItem('sidebarConfig', JSON.stringify(newConfig));
                                toast.success(`${item.name} ${checked ? 'shown' : 'hidden'} in sidebar`);
                                window.dispatchEvent(new Event('sidebarConfigChanged'));
                              }}
                              className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 transition-colors"
                            />
                            <Label htmlFor={singleId} className="flex items-center gap-3 text-sm font-bold text-gray-700 cursor-pointer group-hover:text-indigo-800">
                              <div className="p-2 bg-gray-50 rounded-xl text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all duration-300">
                                {item.icon && <item.icon className="h-4.5 w-4.5" />}
                              </div>
                              {item.name}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900">Pro Tip</h4>
                    <p className="text-xs text-blue-800 mt-1">
                      Unchecking hides that link from the sidebar; grouped sections (Sales, Purchase, …) stay as headers if at least one child link stays visible. You can still open a hidden page by URL if your role allows.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Activity Modal */}
        {showActivityModal && selectedUserActivity && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold">User Activity Dashboard</h3>
                  <p className="text-sm text-gray-600">
                    {selectedUserActivity.name} ({selectedUserActivity.email})
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowActivityModal(false);
                    setSelectedUserActivity(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {activityLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : selectedUserActivity.activity ? (
                <div className="space-y-6">
                  {/* Activity Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <Clock className="h-8 w-8 text-blue-600 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-blue-800">Last Login</p>
                          <p className="text-lg font-semibold text-blue-900">
                            {selectedUserActivity.activity.lastLogin
                              ? new Date(selectedUserActivity.activity.lastLogin).toLocaleString()
                              : 'Never'
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <TrendingUp className="h-8 w-8 text-green-600 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-green-800">Total Logins</p>
                          <p className="text-lg font-semibold text-green-900">
                            {selectedUserActivity.activity.loginCount || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <div className={`h-8 w-8 rounded-full mr-3 flex items-center justify-center ${selectedUserActivity.activity.isOnline ? 'bg-green-500' : 'bg-gray-400'
                          }`}>
                          <div className="h-3 w-3 bg-white rounded-full"></div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-purple-800">Status</p>
                          <p className="text-lg font-semibold text-purple-900">
                            {selectedUserActivity.activity.isOnline ? 'Online' : 'Offline'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Login History */}
                  <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="p-4 border-b border-gray-200">
                      <h4 className="text-md font-semibold flex items-center">
                        <Clock className="h-5 w-5 mr-2" />
                        Recent Login History
                      </h4>
                    </div>
                    <div className="p-4">
                      {selectedUserActivity.activity.loginHistory && selectedUserActivity.activity.loginHistory.length > 0 ? (
                        <div className="space-y-3">
                          {selectedUserActivity.activity.loginHistory.map((login, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="text-sm font-medium">
                                  {new Date(login.loginTime).toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-500">
                                  IP: {login.ipAddress}
                                </p>
                              </div>
                              <div className="text-xs text-gray-500">
                                {login.userAgent?.split(' ')[0] || 'Unknown'}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-4">No login history available</p>
                      )}
                    </div>
                  </div>

                  {/* Permission History */}
                  <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="p-4 border-b border-gray-200">
                      <h4 className="text-md font-semibold flex items-center">
                        <Shield className="h-5 w-5 mr-2" />
                        Permission Change History
                      </h4>
                    </div>
                    <div className="p-4">
                      {selectedUserActivity.activity.permissionHistory && selectedUserActivity.activity.permissionHistory.length > 0 ? (
                        <div className="space-y-3">
                          {selectedUserActivity.activity.permissionHistory.map((change, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${change.changeType === 'created' ? 'bg-green-100 text-green-800' :
                                  change.changeType === 'role_changed' ? 'bg-blue-100 text-blue-800' :
                                    change.changeType === 'permissions_modified' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-gray-100 text-gray-800'
                                  }`}>
                                  {change.changeType.replace('_', ' ').toUpperCase()}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(change.changedAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 mb-1">
                                Changed by: {change.changedBy ?
                                  `${change.changedBy.firstName} ${change.changedBy.lastName}` :
                                  'System'
                                }
                              </p>
                              {change.notes && (
                                <p className="text-xs text-gray-600">{change.notes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-4">No permission changes recorded</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Failed to load activity data</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Password Change Modal */}
        {showPasswordModal && (passwordResetUser || editingUser) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Reset Password</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {(passwordResetUser || editingUser)?.email && `Resetting password for: ${(passwordResetUser || editingUser).email}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordResetUser(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password *
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordResetUser(null);
                  }}
                  variant="secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordReset}
                  disabled={isResettingPassword || !(passwordResetUser || editingUser)}
                  variant="default"
                >
                  {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change My Password Modal */}
        {showMyPasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Change My Password</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {user?.email && `Changing password for: ${user.email}`}
                  </p>
                </div>
                <button
                  onClick={() => setShowMyPasswordModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password *
                  </label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="pr-10"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password *
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> You must enter your current password to change it to a new one.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  onClick={() => setShowMyPasswordModal(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleChangeMyPassword}
                  disabled={isChangingMyPassword}
                  variant="default"
                >
                  {isChangingMyPassword ? 'Changing...' : 'Change Password'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings2;
