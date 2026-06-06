import {
  Smartphone,
  Building,
  Users,
  Printer,
  LayoutDashboard,
  Wallet,
  Package,
  UserPlus,
  BarChart3,
} from 'lucide-react';

export const SETTINGS_TABS = [
  { id: 'company', name: 'Company Information', shortName: 'Company', icon: Building },
  { id: 'users', name: 'Users', shortName: 'Users', icon: Users, permission: 'manage_users' },
  { id: 'print', name: 'Print Preview Settings', shortName: 'Print', icon: Printer, permission: 'manage_print_settings' },
  { id: 'dashboard', name: 'Dashboard Settings', shortName: 'Dashboard', icon: LayoutDashboard },
  { id: 'sidebar', name: 'Sidebar Configuration', shortName: 'Sidebar', icon: LayoutDashboard },
  { id: 'topbar', name: 'Top Bar Configuration', shortName: 'Top Bar', icon: Wallet },
  { id: 'mobile-nav', name: 'Mobile Nav', shortName: 'Mobile Nav', icon: Smartphone },
  { id: 'products', name: 'Product Settings', shortName: 'Products', icon: Package, permission: 'manage_product_settings' },
  { id: 'customers', name: 'Customer Settings', shortName: 'Customers', icon: UserPlus, permission: 'manage_customer_settings' },
  { id: 'suppliers', name: 'Supplier Settings', shortName: 'Suppliers', icon: Building, permission: 'manage_supplier_settings' },
  { id: 'other', name: 'Advanced', shortName: 'Advanced', icon: BarChart3, permission: 'manage_advanced_settings' },
];

export const SETTINGS_VISIBLE_TAB_COUNT = 6;
