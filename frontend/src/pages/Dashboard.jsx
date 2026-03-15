import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  AlertTriangle,
  Bell,
  BarChart3,
  FileText,
  CreditCard,
  Building,
  Wallet,
  Receipt,
  Minus,
  Calendar,
  Search,
  ShoppingBag,
  Banknote,
  ArrowDownCircle,
  ArrowUpCircle,
  Truck,
  Tag,
  Eye,
  EyeOff
} from 'lucide-react';
import DashboardReportModal from '../components/DashboardReportModal';
import {
  useGetTodaySummaryQuery,
  useGetOrdersQuery,
  useLazyGetPeriodSummaryQuery,
} from '../store/services/salesApi';
import { useGetLowStockItemsQuery, useGetInventorySummaryQuery } from '../store/services/inventoryApi';
import { useGetCustomersQuery } from '../store/services/customersApi';
import { useGetSalesOrdersQuery } from '../store/services/salesOrdersApi';
import { useGetPurchaseOrdersQuery } from '../store/services/purchaseOrdersApi';
import { useGetPurchaseInvoicesQuery } from '../store/services/purchaseInvoicesApi';
import { useGetCashReceiptsQuery } from '../store/services/cashReceiptsApi';
import { useGetCashPaymentsQuery } from '../store/services/cashPaymentsApi';
import { useGetBankReceiptsQuery } from '../store/services/bankReceiptsApi';
import { useGetBankPaymentsQuery } from '../store/services/bankPaymentsApi';
import { useGetUpcomingExpensesQuery } from '../store/services/expensesApi';
import { useGetCompanySettingsQuery } from '../store/services/settingsApi';
import { useFetchCompanyQuery } from '../store/services/companyApi';
import { formatCurrency, formatDate } from '../utils/formatters';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage, LoadingInline } from '../components/LoadingSpinner';
import PeriodComparisonSection from '../components/PeriodComparisonSection';
import PeriodComparisonCard from '../components/PeriodComparisonCard';
import ComparisonChart from '../components/ComparisonChart';
import { usePeriodComparison } from '../hooks/usePeriodComparison';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan } from '../utils/dateUtils';

const StatCard = ({ title, value, icon: Icon, color, change, changeType }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3 md:p-4 h-full">
    <div className="text-center flex flex-col justify-center items-center h-full">
      <div className="flex justify-center mb-1 sm:mb-2 md:mb-3">
        <div className={`p-2 sm:p-2.5 md:p-3 rounded-full ${color}`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
        </div>
      </div>
      <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 line-clamp-2">{title}</p>
      <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold text-gray-900 mb-1 break-words">{value}</p>
      <div className="h-4 sm:h-5 flex items-center justify-center space-x-1">
        {change && (
          <>
            {changeType === 'positive' && (
              <svg className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            )}
            <p className={`text-xs sm:text-sm font-medium ${changeType === 'positive' ? 'text-green-600' : 'text-gray-600'}`}>
              {changeType === 'positive' ? '+' : ''}{change}
            </p>
          </>
        )}
      </div>
    </div>
  </div>
);

const DASHBOARD_HIDDEN_KEY = 'dashboardDataHidden';

export const Dashboard = () => {
  const navigate = useNavigate();
  const today = getCurrentDatePakistan();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Hide dashboard data: when true, show only business logo; when false, show full dashboard
  const [dashboardHidden, setDashboardHidden] = useState(() => {
    try {
      return localStorage.getItem(DASHBOARD_HIDDEN_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleDashboardVisibility = () => {
    const next = !dashboardHidden;
    setDashboardHidden(next);
    try {
      localStorage.setItem(DASHBOARD_HIDDEN_KEY, String(next));
    } catch (_) {}
  };

  // Listen for dashboard visibility changes from MultiTabLayout
  useEffect(() => {
    const handleVisibilityChange = (event) => {
      setDashboardHidden(event.detail.hidden);
    };
    window.addEventListener('dashboardVisibilityChanged', handleVisibilityChange);
    return () => {
      window.removeEventListener('dashboardVisibilityChanged', handleVisibilityChange);
    };
  }, []);

  // Modal states
  const [showSalesOrdersModal, setShowSalesOrdersModal] = useState(false);
  const [showPurchaseOrdersModal, setShowPurchaseOrdersModal] = useState(false);
  const [showSalesInvoicesModal, setShowSalesInvoicesModal] = useState(false);
  const [showPurchaseInvoicesModal, setShowPurchaseInvoicesModal] = useState(false);
  const [showCashReceiptsModal, setShowCashReceiptsModal] = useState(false);
  const [showCashPaymentsModal, setShowCashPaymentsModal] = useState(false);
  const [showBankReceiptsModal, setShowBankReceiptsModal] = useState(false);
  const [showBankPaymentsModal, setShowBankPaymentsModal] = useState(false);

  // Lazy query for period summary
  const [getPeriodSummary] = useLazyGetPeriodSummaryQuery();

  // Handle date change from DateFilter component
  const handleDateChange = (newStartDate, newEndDate) => {
    setStartDate(newStartDate || '');
    setEndDate(newEndDate || '');
  };

  // Wrapper function for period summary that matches the expected API format
  const fetchPeriodSummary = async (params) => {
    try {
      const result = await getPeriodSummary(params).unwrap();
      return {
        data: {
          data: result.data || result
        }
      };
    } catch (error) {
      // Error fetching period summary - silent fail
      return {
        data: {
          data: {
            totalRevenue: 0,
            totalOrders: 0,
            averageOrderValue: 0,
            totalItems: 0
          }
        }
      };
    }
  };

  const { data: todaySummary, isLoading: summaryLoading, error: todaySummaryError } = useGetTodaySummaryQuery(undefined, {
    pollingInterval: 30000, // Refetch every 30 seconds
  });

  // Debug: Log the summary data to see what we're getting

  if (todaySummaryError) {
    console.error('Today Summary Error:', todaySummaryError);
  }

  const { data: lowStockData, isLoading: lowStockLoading } = useGetLowStockItemsQuery();

  const { data: inventoryData, isLoading: inventoryLoading } = useGetInventorySummaryQuery();

  const { data: customersData, isLoading: customersLoading } = useGetCustomersQuery(
    { status: 'active' }
  );

  // Pending Sales Orders data (draft status only)
  const { data: pendingSalesOrdersData, isLoading: pendingSalesOrdersLoading } = useGetSalesOrdersQuery(
    { status: 'draft' }
  );

  // All Sales Orders data (for total value calculation)
  // Use 'all' parameter to get all orders without pagination
  const { data: salesOrdersData, isLoading: salesOrdersLoading } = useGetSalesOrdersQuery(
    { dateFrom: startDate, dateTo: endDate, all: true },
    { skip: !startDate || !endDate }
  );

  // Pending Purchase Orders data (draft status only)
  const { data: pendingPurchaseOrdersData, isLoading: pendingPurchaseOrdersLoading } = useGetPurchaseOrdersQuery(
    { status: 'draft' }
  );

  // All Purchase Orders data (for total value calculation)
  const { data: purchaseOrdersData, isLoading: purchaseOrdersLoading } = useGetPurchaseOrdersQuery(
    { dateFrom: startDate, dateTo: endDate },
    { skip: !startDate || !endDate }
  );

  // Sales Invoices (from Sales page) - actual completed sales
  // Use 'all' parameter to get all orders without pagination
  const { data: salesInvoicesData, isLoading: salesInvoicesLoading } = useGetOrdersQuery(
    { dateFrom: startDate, dateTo: endDate, all: true },
    { skip: !startDate || !endDate }
  );

  // Purchase Invoices (from Purchase page) - actual purchases
  const { data: purchaseInvoicesData, isLoading: purchaseInvoicesLoading } = useGetPurchaseInvoicesQuery(
    { dateFrom: startDate, dateTo: endDate },
    { skip: !startDate || !endDate }
  );

  // Cash Receipts data
  const { data: cashReceiptsData, isLoading: cashReceiptsLoading } = useGetCashReceiptsQuery(
    { dateFrom: startDate, dateTo: endDate },
    { skip: !startDate || !endDate }
  );

  // Cash Payments data
  const { data: cashPaymentsData, isLoading: cashPaymentsLoading } = useGetCashPaymentsQuery(
    { dateFrom: startDate, dateTo: endDate },
    { skip: !startDate || !endDate }
  );

  // Bank Receipts data
  const { data: bankReceiptsData, isLoading: bankReceiptsLoading } = useGetBankReceiptsQuery(
    { dateFrom: startDate, dateTo: endDate },
    { skip: !startDate || !endDate }
  );

  // Bank Payments data
  const { data: bankPaymentsData, isLoading: bankPaymentsLoading } = useGetBankPaymentsQuery(
    { dateFrom: startDate, dateTo: endDate },
    { skip: !startDate || !endDate }
  );

  const { data: recurringExpensesData, isLoading: recurringExpensesLoading } = useGetUpcomingExpensesQuery(
    { days: 14 },
    { pollingInterval: 60000 }
  );

  const { data: companySettingsData } = useGetCompanySettingsQuery();
  const { data: companyData } = useFetchCompanyQuery();

  if (summaryLoading || lowStockLoading || inventoryLoading || customersLoading ||
    salesOrdersLoading || pendingSalesOrdersLoading || purchaseOrdersLoading || pendingPurchaseOrdersLoading ||
    salesInvoicesLoading || purchaseInvoicesLoading || cashReceiptsLoading ||
    cashPaymentsLoading || bankReceiptsLoading || bankPaymentsLoading || recurringExpensesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Handle different response structures from RTK Query
  // RTK Query wraps responses in 'data', but some APIs return data directly
  const summary = todaySummary?.data?.summary || todaySummary?.summary || {};
  const lowStockCount = lowStockData?.data?.products?.length || lowStockData?.products?.length || 0;
  const inventorySummary = inventoryData?.data?.summary || inventoryData?.summary || {};

  const activeCustomersCount = customersData?.data?.customers?.length || customersData?.customers?.length || 0;

  // Extract counts from API responses
  const pendingSalesOrdersCount = pendingSalesOrdersData?.data?.salesOrders?.length || pendingSalesOrdersData?.salesOrders?.length || 0;
  const pendingPurchaseOrdersCount = pendingPurchaseOrdersData?.data?.purchaseOrders?.length || pendingPurchaseOrdersData?.purchaseOrders?.length || 0;
  const cashReceiptsCount = cashReceiptsData?.data?.cashReceipts?.length || 0;
  const cashPaymentsCount = cashPaymentsData?.data?.cashPayments?.length || 0;
  const bankReceiptsCount = bankReceiptsData?.data?.bankReceipts?.length || 0;
  const bankPaymentsCount = bankPaymentsData?.data?.bankPayments?.length || 0;

  const upcomingRecurringExpenses = recurringExpensesData?.data || recurringExpensesData?.expenses || [];

  const calculateDaysUntilDue = (dateString) => {
    if (!dateString) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateString);
    due.setHours(0, 0, 0, 0);
    const diff = due.getTime() - today.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  };

  const getRecurringPayeeName = (expense) => {
    if (expense?.supplier) {
      return (
        expense.supplier.displayName ||
        expense.supplier.companyName ||
        expense.supplier.businessName ||
        expense.supplier.name
      );
    }
    if (expense?.customer) {
      return (
        expense.customer.displayName ||
        expense.customer.businessName ||
        expense.customer.name ||
        [expense.customer.firstName, expense.customer.lastName].filter(Boolean).join(' ')
      );
    }
    return 'General Expense';
  };

  // Calculate totals for financial metrics
  // RTK Query wraps axios response in 'data', so structure is: { data: { salesOrders: [...], pagination: {...} } }
  // Sales Orders use `total` directly, not `pricing.total`
  const salesOrdersArray = salesOrdersData?.data?.salesOrders || salesOrdersData?.salesOrders || [];
  const salesOrdersTotal = salesOrdersArray.reduce((sum, order) => {
    const orderTotal = order.total || order.pricing?.total || 0;
    return sum + Number(orderTotal);
  }, 0);

  const purchaseOrdersTotal = (purchaseOrdersData?.data?.purchaseOrders || purchaseOrdersData?.purchaseOrders || []).reduce((sum, order) => {
    return sum + Number(order.pricing?.total || order.total || 0);
  }, 0);

  // Sales Invoices (from Sales/POS page) - use `pricing.total`
  // RTK Query wraps axios response in 'data', so structure is: { data: { orders: [...], pagination: {...} } }
  // Also handle direct response structure (no data wrapper)
  const salesInvoicesArray = salesInvoicesData?.data?.orders || salesInvoicesData?.orders || [];
  const salesInvoicesTotal = salesInvoicesArray.reduce((sum, order) => {
    const orderTotal = order.pricing?.total || order.total || 0;
    return sum + Number(orderTotal);
  }, 0);

  // Purchase Invoices (from Purchase page)
  const purchaseInvoicesTotal = purchaseInvoicesData?.data?.invoices?.reduce((sum, invoice) => sum + (invoice.pricing?.total || 0), 0) ||
    purchaseInvoicesData?.invoices?.reduce((sum, invoice) => sum + (invoice.pricing?.total || 0), 0) || 0;

  const cashReceiptsTotal = cashReceiptsData?.data?.cashReceipts?.reduce((sum, receipt) => sum + (receipt.amount || 0), 0) || 0;
  const cashPaymentsTotal = cashPaymentsData?.data?.cashPayments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
  const bankReceiptsTotal = bankReceiptsData?.data?.bankReceipts?.reduce((sum, receipt) => sum + (receipt.amount || 0), 0) || 0;
  const bankPaymentsTotal = bankPaymentsData?.data?.bankPayments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;

  // Calculate total sales (Sales Orders + Sales Invoices)
  const totalSales = salesOrdersTotal + salesInvoicesTotal;

  // Calculate total purchases (Purchase Orders + Purchase Invoices) - COGS
  const totalPurchases = purchaseOrdersTotal + purchaseInvoicesTotal;

  // Calculate total discounts from sales orders and sales invoices
  const salesOrdersDiscounts = salesOrdersData?.data?.salesOrders?.reduce((sum, order) => sum + (order.pricing?.discountAmount || 0), 0) || 0;
  const salesInvoicesDiscounts = salesInvoicesData?.data?.orders?.reduce((sum, order) => sum + (order.discountAmount || 0), 0) ||
    salesInvoicesData?.orders?.reduce((sum, order) => sum + (order.discountAmount || 0), 0) || 0;
  const totalDiscounts = salesOrdersDiscounts + salesInvoicesDiscounts;

  // Separate Cash/Bank Payments into Supplier Payments vs Operating Expenses
  // Operating expenses are payments that don't have a supplier or customer (general expenses)
  const cashPayments = cashPaymentsData?.data?.cashPayments || [];
  const bankPayments = bankPaymentsData?.data?.bankPayments || [];

  const cashOperatingExpenses = cashPayments
    .filter(payment => !payment?.supplier && !payment?.customer)
    .reduce((sum, payment) => sum + (payment.amount || 0), 0);

  const bankOperatingExpenses = bankPayments
    .filter(payment => !payment?.supplier && !payment?.customer)
    .reduce((sum, payment) => sum + (payment.amount || 0), 0);

  const operatingExpenses = cashOperatingExpenses + bankOperatingExpenses;

  const totalCashPayments = cashPaymentsTotal;
  const totalBankPayments = bankPaymentsTotal;
  const totalPayments = totalCashPayments + totalBankPayments; // Includes both supplier payments and expenses

  // Cash Flow Calculations
  const totalCashReceipts = cashReceiptsTotal;
  const totalBankReceipts = bankReceiptsTotal;
  const totalReceipts = totalCashReceipts + totalBankReceipts;
  const netCashFlow = totalReceipts - totalPayments;

  // Financial Performance Calculations
  const grossRevenue = totalSales; // Total sales before discounts
  const netRevenue = totalSales - totalDiscounts; // Sales after discounts
  const costOfGoodsSold = totalPurchases; // COGS
  const grossProfit = netRevenue - costOfGoodsSold; // Gross Profit
  const netProfit = grossProfit - operatingExpenses;

  // Column definitions for modals
  const salesOrdersColumns = [
    { key: 'soNumber', label: 'Order Number', sortable: true },
    { key: 'customer', label: 'Customer', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.name || '-' },
    { key: 'orderDate', label: 'Date', sortable: true, format: 'date' },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'total', label: 'Total', sortable: true, format: 'currency' }
  ];

  const purchaseOrdersColumns = [
    { key: 'poNumber', label: 'PO Number', sortable: true },
    { key: 'supplier', label: 'Supplier', sortable: true, render: (val, row) => row.supplier?.companyName || row.supplier?.name || '-' },
    { key: 'orderDate', label: 'Date', sortable: true, format: 'date' },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'total', label: 'Total', sortable: true, format: 'currency' }
  ];

  const salesInvoicesColumns = [
    { key: 'orderNumber', label: 'Order Number', sortable: true },
    { key: 'customer', label: 'Customer', sortable: true, render: (val, row) => row.customerInfo?.businessName || row.customerInfo?.name || '-' },
    { key: 'createdAt', label: 'Date', sortable: true, format: 'date' },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'pricing', label: 'Total', sortable: true, render: (val) => formatCurrency(val?.total || 0) }
  ];

  const purchaseInvoicesColumns = [
    { key: 'invoiceNumber', label: 'Invoice Number', sortable: true },
    { key: 'supplier', label: 'Supplier', sortable: true, render: (val, row) => row.supplier?.companyName || row.supplier?.name || '-' },
    { key: 'invoiceDate', label: 'Date', sortable: true, format: 'date' },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'pricing', label: 'Total', sortable: true, render: (val) => formatCurrency(val?.total || 0) }
  ];

  const cashReceiptsColumns = [
    { key: 'voucherCode', label: 'Voucher Code', sortable: true },
    { key: 'customer', label: 'Customer', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.name || '-' },
    { key: 'date', label: 'Date', sortable: true, format: 'date' },
    { key: 'particular', label: 'Particular', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, format: 'currency' }
  ];

  const cashPaymentsColumns = [
    { key: 'voucherCode', label: 'Voucher Code', sortable: true },
    { key: 'supplier', label: 'Supplier', sortable: true, render: (val, row) => row.supplier?.companyName || row.supplier?.name || '-' },
    { key: 'customer', label: 'Customer', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.name || '-' },
    { key: 'date', label: 'Date', sortable: true, format: 'date' },
    { key: 'particular', label: 'Particular', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, format: 'currency' }
  ];

  const bankReceiptsColumns = [
    { key: 'voucherCode', label: 'Voucher Code', sortable: true },
    { key: 'customer', label: 'Customer', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.name || '-' },
    { key: 'date', label: 'Date', sortable: true, format: 'date' },
    { key: 'particular', label: 'Particular', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, format: 'currency' }
  ];

  const bankPaymentsColumns = [
    { key: 'voucherCode', label: 'Voucher Code', sortable: true },
    { key: 'supplier', label: 'Supplier', sortable: true, render: (val, row) => row.supplier?.companyName || row.supplier?.name || '-' },
    { key: 'customer', label: 'Customer', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.name || '-' },
    { key: 'date', label: 'Date', sortable: true, format: 'date' },
    { key: 'particular', label: 'Particular', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, format: 'currency' }
  ];

  // Prepare data arrays for modals
  const salesOrdersModalData = salesOrdersArray;
  const purchaseOrdersModalData = purchaseOrdersData?.data?.purchaseOrders || purchaseOrdersData?.purchaseOrders || [];
  const salesInvoicesModalData = salesInvoicesArray;
  const purchaseInvoicesDataArray = purchaseInvoicesData?.data?.invoices || purchaseInvoicesData?.invoices || [];
  const cashReceiptsDataArray = cashReceiptsData?.data?.cashReceipts || [];
  const cashPaymentsDataArray = cashPayments;
  const bankReceiptsDataArray = bankReceiptsData?.data?.bankReceipts || [];
  const bankPaymentsDataArray = bankPayments;

  const companyInfo = companySettingsData?.data || {};
  const companyFromApi = companyData?.data || companyData || {};
  const companyLogo = companyFromApi.logo || companyInfo.logo;
  const companyName = companyInfo.companyName || companyInfo.businessName || companyFromApi.companyName || '';

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">Welcome back! Here's what's happening today.</p>
        </div>

        {/* Hide Data Button - Mobile only (no date filter here to save space) */}
        <div className="flex items-center justify-end gap-2 w-full sm:w-auto lg:hidden">
          <button
            type="button"
            onClick={toggleDashboardVisibility}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors"
            title={dashboardHidden ? 'Show dashboard data' : 'Hide dashboard data'}
          >
            {dashboardHidden ? (
              <>
                <Eye className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Show data</span>
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Hide data</span>
              </>
            )}
          </button>
        </div>

        {/* Date Filter and Hide Data Button - Desktop only */}
        <div className="hidden lg:flex items-center gap-3 w-full sm:w-auto">
          <DateFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
            compact={true}
            showPresets={true}
            className="w-full"
          />
          <button
            type="button"
            onClick={toggleDashboardVisibility}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-xs sm:text-sm font-medium transition-colors flex-shrink-0 whitespace-nowrap"
            title={dashboardHidden ? 'Show dashboard data' : 'Hide dashboard data'}
          >
            {dashboardHidden ? (
              <>
                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Unhide data</span>
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Hide data</span>
              </>
            )}
          </button>
        </div>
      </div>

      {dashboardHidden ? (
        <div className="min-h-[60vh] flex flex-col items-center justify-center bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <div className="flex flex-col items-center gap-6 max-w-md text-center">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName || 'Company logo'}
                className="max-h-48 w-auto max-w-full object-contain"
              />
            ) : (
              <div className="w-40 h-40 rounded-xl bg-gray-100 flex items-center justify-center">
                <Building className="h-20 w-20 text-gray-400" />
              </div>
            )}
            {companyName ? (
              <h2 className="text-xl font-semibold text-gray-800">{companyName}</h2>
            ) : null}
          </div>
        </div>
      ) : (
        <>

      {upcomingRecurringExpenses.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-medium text-gray-900 flex items-center space-x-2">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
                <span>Upcoming Monthly Obligations</span>
              </h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Stay ahead of salaries, rent, and other committed expenses.
              </p>
            </div>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {upcomingRecurringExpenses.slice(0, 4).map((expense) => {
                const daysLeft = calculateDaysUntilDue(expense.nextDueDate);
                const isOverdue = typeof daysLeft === 'number' && daysLeft < 0;
                return (
                  <div
                    key={expense._id}
                    className={`border rounded-lg p-4 shadow-sm ${isOverdue ? 'border-danger-200 bg-danger-50/60' : 'border-gray-200 bg-white'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {expense.defaultPaymentType === 'bank' ? 'Bank Payment' : 'Cash Payment'}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">{expense.name}</h3>
                    <p className="text-sm text-gray-600">{getRecurringPayeeName(expense)}</p>
                    <p className="text-lg font-bold text-gray-900 mt-2">
                      {formatCurrency(expense.amount)}
                    </p>
                    <div className="mt-2 text-sm text-gray-600 flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>Due {formatDate(expense.nextDueDate)}</span>
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${isOverdue
                            ? 'bg-danger-100 text-danger-700'
                            : 'bg-primary-100 text-primary-700'
                          }`}
                      >
                        {isOverdue ? `${Math.abs(daysLeft)} day(s) overdue` : `${daysLeft} day(s) left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {upcomingRecurringExpenses.length > 4 && (
              <p className="text-xs text-gray-500 mt-3">
                Showing first 4 reminders. Review all recurring expenses from the Cash Payments page.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Financial Dashboard */}
      <div className="card">
        <div className="card-header">
          <div className="flex flex-col items-center space-y-2 sm:space-y-4">
            <h2 className="text-sm sm:text-lg font-medium text-gray-900">Financial Overview</h2>
            {/* Date Filter - Mobile only */}
            <div className="flex flex-row items-center space-x-1.5 sm:space-x-4 w-full sm:w-auto lg:hidden">
              <div className="w-full sm:w-auto">
                <DateFilter
                  startDate={startDate}
                  endDate={endDate}
                  onDateChange={handleDateChange}
                  compact={true}
                  showPresets={true}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="card-content space-y-6">

          {/* REVENUE, COST & DISCOUNT SECTION */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Revenue, Cost & Discounts</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4">

              {/* Sales */}
              <div
                className="text-center p-2 sm:p-3 md:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors relative group shadow-sm"
                onClick={() => setShowSalesInvoicesModal(true)}
              >
                <div className="absolute top-1 right-1 sm:top-2 sm:right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
                </div>
                <div className="flex justify-center mb-1 sm:mb-2">
                  <div className="p-2 sm:p-2.5 md:p-3 bg-green-500 rounded-full">
                    <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Sales (Revenue)</p>
                <p className="text-base sm:text-lg md:text-xl font-bold text-gray-900 break-words">{Math.round(totalSales).toLocaleString()}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1 hidden sm:block">SO: {Math.round(salesOrdersTotal)} | SI: {Math.round(salesInvoicesTotal)}</p>
              </div>

              {/* Purchase (COGS) */}
              <div
                className="text-center p-2 sm:p-3 md:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors relative group shadow-sm"
                onClick={() => setShowPurchaseInvoicesModal(true)}
              >
                <div className="absolute top-1 right-1 sm:top-2 sm:right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
                </div>
                <div className="flex justify-center mb-1 sm:mb-2">
                  <div className="p-2 sm:p-2.5 md:p-3 bg-purple-500 rounded-full">
                    <Truck className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Purchase (COGS)</p>
                <p className="text-base sm:text-lg md:text-xl font-bold text-gray-900 break-words">{Math.round(totalPurchases).toLocaleString()}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1 hidden sm:block">PO: {Math.round(purchaseOrdersTotal)} | PI: {Math.round(purchaseInvoicesTotal)}</p>
              </div>

              {/* Discount */}
              <div className="text-center p-2 sm:p-3 md:p-4 border border-gray-200 bg-white rounded-lg shadow-sm">
                <div className="flex justify-center mb-1 sm:mb-2">
                  <div className="p-2 sm:p-2.5 md:p-3 bg-red-500 rounded-full">
                    <Tag className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Discount Given</p>
                <p className="text-base sm:text-lg md:text-xl font-bold text-gray-900 break-words">{Math.round(totalDiscounts).toLocaleString()}</p>
              </div>

              {/* Pending Sales Orders */}
              <div
                className="text-center p-2 sm:p-3 md:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
                onClick={() => navigate('/sales-orders')}
              >
                <div className="flex justify-center mb-1 sm:mb-2">
                  <div className="p-2 sm:p-2.5 md:p-3 bg-cyan-500 rounded-full">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Pending Sales Orders</p>
                <p className="text-base sm:text-lg md:text-xl font-bold text-gray-900 break-words">{pendingSalesOrdersCount}</p>
              </div>

              {/* Pending Purchase Orders */}
              <div
                className="text-center p-2 sm:p-3 md:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
                onClick={() => navigate('/purchase-orders')}
              >
                <div className="flex justify-center mb-1 sm:mb-2">
                  <div className="p-2 sm:p-2.5 md:p-3 bg-indigo-500 rounded-full">
                    <Receipt className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Pending Purchase Orders</p>
                <p className="text-base sm:text-lg md:text-xl font-bold text-gray-900 break-words">{pendingPurchaseOrdersCount}</p>
              </div>
            </div>
          </div>

          {/* PROFITABILITY & CASH FLOW SECTION */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Profitability & Cash Flow</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">

              {/* Gross Profit */}
              <div className="text-center p-2 sm:p-3 md:p-4 border border-gray-200 bg-white rounded-lg shadow-sm">
                <div className="flex justify-center mb-1 sm:mb-2">
                  <div className="p-2 sm:p-2.5 md:p-3 bg-blue-500 rounded-full">
                    <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Gross Profit</p>
                <p className={`text-base sm:text-lg md:text-xl font-bold break-words ${grossProfit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  {Math.round(grossProfit).toLocaleString()}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1 hidden sm:block">Revenue - COGS</p>
              </div>

              {/* Total Receipts */}
              <div
                className="text-center p-2 sm:p-3 md:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors relative group shadow-sm"
                onClick={() => setShowCashReceiptsModal(true)}
              >
                <div className="absolute top-1 right-1 sm:top-2 sm:right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
                </div>
                <div className="flex justify-center mb-1 sm:mb-2">
                  <div className="p-2 sm:p-2.5 md:p-3 bg-emerald-500 rounded-full">
                    <Receipt className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Total Receipts</p>
                <p className="text-base sm:text-lg md:text-xl font-bold text-gray-900 break-words">{Math.round(totalReceipts).toLocaleString()}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1 hidden sm:block">Cash: {Math.round(totalCashReceipts)} | Bank: {Math.round(totalBankReceipts)}</p>
              </div>

              {/* Total Payments */}
              <div
                className="text-center p-2 sm:p-3 md:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors relative group shadow-sm"
                onClick={() => setShowCashPaymentsModal(true)}
              >
                <div className="absolute top-1 right-1 sm:top-2 sm:right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
                </div>
                <div className="flex justify-center mb-1 sm:mb-2">
                  <div className="p-2 sm:p-2.5 md:p-3 bg-orange-500 rounded-full">
                    <Banknote className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Total Payments</p>
                <p className="text-base sm:text-lg md:text-xl font-bold text-gray-900 break-words">{Math.round(totalPayments).toLocaleString()}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1 hidden sm:block">Cash: {Math.round(totalCashPayments)} | Bank: {Math.round(totalBankPayments)}</p>
              </div>

              {/* Net Cash Flow */}
              <div className="text-center p-2 sm:p-3 md:p-4 border border-gray-200 bg-white rounded-lg shadow-sm">
                <div className="flex justify-center mb-1 sm:mb-2">
                  <div className={`p-2 sm:p-2.5 md:p-3 rounded-full ${netCashFlow >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                    <Wallet className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Net Cash Flow</p>
                <p className={`text-base sm:text-lg md:text-xl font-bold break-words ${netCashFlow >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  {Math.round(netCashFlow).toLocaleString()}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1 hidden sm:block">Receipts - Payments</p>
              </div>

              {/* Total Orders */}
              <div className="text-center p-2 sm:p-3 md:p-4 border border-gray-200 bg-white rounded-lg shadow-sm">
                <div className="flex justify-center mb-1 sm:mb-2">
                  <div className="p-2 sm:p-2.5 md:p-3 bg-yellow-500 rounded-full">
                    <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Total Transactions</p>
                <p className="text-base sm:text-lg md:text-xl font-bold text-gray-900 break-words">{summary.totalOrders || 0}</p>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid - Single Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 md:gap-5">
        <StatCard
          title="Today's Revenue"
          value={`${summary.totalRevenue?.toFixed(2) || '0.00'}`}
          icon={TrendingUp}
          color="bg-success-500"
          change="12%"
          changeType="positive"
        />
        <StatCard
          title="Orders Today"
          value={summary.totalOrders || 0}
          icon={ShoppingCart}
          color="bg-primary-500"
          change="8%"
          changeType="positive"
        />
        <StatCard
          title="Total Products"
          value={inventorySummary.totalProducts || 0}
          icon={Package}
          color="bg-warning-500"
        />
        <StatCard
          title="Active Customers"
          value={activeCustomersCount.toLocaleString()}
          icon={Users}
          color="bg-purple-500"
          change="5%"
          changeType="positive"
        />
        <StatCard
          title="Items Sold Today"
          value={summary.totalItems || 0}
          icon={TrendingUp}
          color="bg-blue-500"
        />
        <StatCard
          title="Average Order Value"
          value={`${summary.averageOrderValue?.toFixed(2) || '0.00'}`}
          icon={BarChart3}
          color="bg-indigo-500"
        />
        <StatCard
          title="Low Stock Items"
          value={lowStockCount}
          icon={AlertTriangle}
          color="bg-danger-500"
        />
      </div>

      {/* Period Comparison Section */}
      <PeriodComparisonSection
        title="Sales Performance Comparison"
        metrics={[
          {
            title: 'Total Revenue',
            fetchFunction: (params) => fetchPeriodSummary(params).then(res => ({
              data: res.data?.data?.totalRevenue || 0
            })),
            format: 'currency',
            icon: TrendingUp,
            iconColor: 'bg-green-500'
          },
          {
            title: 'Total Orders',
            fetchFunction: (params) => fetchPeriodSummary(params).then(res => ({
              data: res.data?.data?.totalOrders || 0
            })),
            format: 'number',
            icon: ShoppingCart,
            iconColor: 'bg-blue-500'
          },
          {
            title: 'Average Order Value',
            fetchFunction: (params) => fetchPeriodSummary(params).then(res => ({
              data: res.data?.data?.averageOrderValue || 0
            })),
            format: 'currency',
            icon: TrendingUp,
            iconColor: 'bg-purple-500'
          },
          {
            title: 'Total Items Sold',
            fetchFunction: (params) => fetchPeriodSummary(params).then(res => ({
              data: res.data?.data?.totalItems || 0
            })),
            format: 'number',
            icon: Package,
            iconColor: 'bg-orange-500'
          }
        ]}
        fetchFunction={fetchPeriodSummary}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Orders */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">Today's Orders</h3>
          </div>
          <div className="card-content">
            {summary.orderTypes ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Retail Orders</span>
                  <span className="font-medium">{summary.orderTypes.retail || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Wholesale Orders</span>
                  <span className="font-medium">{summary.orderTypes.wholesale || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Returns</span>
                  <span className="font-medium">{summary.orderTypes.return || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Exchanges</span>
                  <span className="font-medium">{summary.orderTypes.exchange || 0}</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No orders today</p>
            )}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">Low Stock Alert</h3>
          </div>
          <div className="card-content">
            {lowStockCount > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  {lowStockCount} products are running low on stock
                </p>
                <div className="space-y-1">
                  {lowStockData?.data?.products?.slice(0, 3).map((product) => (
                    <div key={product._id} className="flex justify-between items-center text-sm">
                      <span className="truncate">{product.name}</span>
                      <span className="text-danger-600 font-medium">
                        {product.inventory.currentStock} left
                      </span>
                    </div>
                  ))}
                </div>
                {lowStockCount > 3 && (
                  <p className="text-xs text-gray-500">
                    And {lowStockCount - 3} more...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-success-600">All products are well stocked!</p>
            )}
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      {summary.paymentMethods && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">Payment Methods Today</h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {Object.entries(summary.paymentMethods).map(([method, count]) => (
                <div key={method} className="text-center">
                  <p className="text-2xl font-semibold text-gray-900">{count}</p>
                  <p className="text-sm text-gray-600 capitalize">
                    {method.replace('_', ' ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Financial Metrics Legend */}
      <div className="card bg-gray-50 border-gray-200">
        <div className="card-content">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-3">📊 Financial Metrics Explained</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 text-xs text-gray-700">
            <div><strong>Sales:</strong> Total revenue from Sales Orders + Sales Invoices</div>
            <div><strong>Net Revenue:</strong> Sales minus discounts given</div>
            <div><strong>Purchase (COGS):</strong> Cost of goods purchased from suppliers</div>
            <div><strong>Gross Profit:</strong> Net Revenue - COGS (your margin)</div>
            <div><strong>Receipts:</strong> Cash/Bank money received (includes sales + customer payments)</div>
            <div><strong>Payments:</strong> Cash/Bank money paid (includes supplier payments + expenses)</div>
            <div><strong>Net Cash Flow:</strong> Total receipts minus total payments (cash position)</div>
            <div className="md:col-span-2 lg:col-span-3 mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded">
              <strong>⚠️ Note:</strong> Receipts/Payments may include both sales/purchases AND separate cash/bank transactions. For accurate accounting, check individual transaction pages.
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <DashboardReportModal
        isOpen={showSalesOrdersModal}
        onClose={() => setShowSalesOrdersModal(false)}
        title="Sales Orders"
        columns={salesOrdersColumns}
        data={salesOrdersModalData}
        isLoading={salesOrdersLoading}
        dateFrom={startDate}
        dateTo={endDate}
        onDateChange={(from, to) => {
          setStartDate(from);
          setEndDate(to);
        }}
      />

      <DashboardReportModal
        isOpen={showPurchaseOrdersModal}
        onClose={() => setShowPurchaseOrdersModal(false)}
        title="Purchase Orders"
        columns={purchaseOrdersColumns}
        data={purchaseOrdersModalData}
        isLoading={purchaseOrdersLoading}
        dateFrom={startDate}
        dateTo={endDate}
        onDateChange={(from, to) => {
          setStartDate(from);
          setEndDate(to);
        }}
      />

      <DashboardReportModal
        isOpen={showSalesInvoicesModal}
        onClose={() => setShowSalesInvoicesModal(false)}
        title="Sales Invoices"
        columns={salesInvoicesColumns}
        data={salesInvoicesModalData}
        isLoading={salesInvoicesLoading}
        dateFrom={startDate}
        dateTo={endDate}
        onDateChange={(from, to) => {
          setStartDate(from);
          setEndDate(to);
        }}
      />

      <DashboardReportModal
        isOpen={showPurchaseInvoicesModal}
        onClose={() => setShowPurchaseInvoicesModal(false)}
        title="Purchase Invoices"
        columns={purchaseInvoicesColumns}
        data={purchaseInvoicesDataArray}
        isLoading={purchaseInvoicesLoading}
        dateFrom={startDate}
        dateTo={endDate}
        onDateChange={(from, to) => {
          setStartDate(from);
          setEndDate(to);
        }}
      />

      <DashboardReportModal
        isOpen={showCashReceiptsModal}
        onClose={() => setShowCashReceiptsModal(false)}
        title="Cash Receipts"
        columns={cashReceiptsColumns}
        data={cashReceiptsDataArray}
        isLoading={cashReceiptsLoading}
        dateFrom={startDate}
        dateTo={endDate}
        onDateChange={(from, to) => {
          setStartDate(from);
          setEndDate(to);
        }}
      />

      <DashboardReportModal
        isOpen={showCashPaymentsModal}
        onClose={() => setShowCashPaymentsModal(false)}
        title="Cash Payments"
        columns={cashPaymentsColumns}
        data={cashPaymentsDataArray}
        isLoading={cashPaymentsLoading}
        dateFrom={startDate}
        dateTo={endDate}
        onDateChange={(from, to) => {
          setStartDate(from);
          setEndDate(to);
        }}
      />

      <DashboardReportModal
        isOpen={showBankReceiptsModal}
        onClose={() => setShowBankReceiptsModal(false)}
        title="Bank Receipts"
        columns={bankReceiptsColumns}
        data={bankReceiptsDataArray}
        isLoading={bankReceiptsLoading}
        dateFrom={startDate}
        dateTo={endDate}
        onDateChange={(from, to) => {
          setStartDate(from);
          setEndDate(to);
        }}
      />

      <DashboardReportModal
        isOpen={showBankPaymentsModal}
        onClose={() => setShowBankPaymentsModal(false)}
        title="Bank Payments"
        columns={bankPaymentsColumns}
        data={bankPaymentsDataArray}
        isLoading={bankPaymentsLoading}
        dateFrom={startDate}
        dateTo={endDate}
        onDateChange={(from, to) => {
          setStartDate(from);
          setEndDate(to);
        }}
      />
        </>
      )}
    </div>
  );
};
