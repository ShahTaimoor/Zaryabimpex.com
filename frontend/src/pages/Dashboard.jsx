import React, { useState, useEffect } from 'react';
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
  useLazyGetOrdersQuery,
  useLazyGetPeriodSummaryQuery,
} from '../store/services/salesApi';
import { useGetLowStockItemsQuery, useGetInventorySummaryQuery, useGetAlertSummaryQuery } from '../store/services/inventoryApi';
import { useGetCustomersQuery } from '../store/services/customersApi';
import { useLazyGetSalesOrdersQuery } from '../store/services/salesOrdersApi';
import { useLazyGetPurchaseOrdersQuery } from '../store/services/purchaseOrdersApi';
import { useConfirmSalesOrderMutation, useCancelSalesOrderMutation } from '../store/services/salesOrdersApi';
import { useConfirmPurchaseOrderMutation, useCancelPurchaseOrderMutation } from '../store/services/purchaseOrdersApi';
import { useLazyGetPurchaseInvoicesQuery } from '../store/services/purchaseInvoicesApi';
import { useLazyGetCashReceiptsQuery } from '../store/services/cashReceiptsApi';
import { useLazyGetCashPaymentsQuery } from '../store/services/cashPaymentsApi';
import { useLazyGetBankReceiptsQuery } from '../store/services/bankReceiptsApi';
import { useLazyGetBankPaymentsQuery } from '../store/services/bankPaymentsApi';
import { useGetLowStockAlertsQuery } from '../store/services/inventoryAlertsApi';
import { useGetDashboardRangeSummaryQuery } from '../store/services/dashboardApi';
import { useGetUpcomingExpensesQuery } from '../store/services/expensesApi';
import { useGetCompanySettingsQuery } from '../store/services/settingsApi';
import { useGetSummaryQuery } from '../store/services/plStatementsApi';
import { useFetchCompanyQuery } from '../store/services/companyApi';
import { formatCurrency, formatDate } from '../utils/formatters';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage, LoadingInline } from '../components/LoadingSpinner';
import PeriodComparisonSection from '../components/PeriodComparisonSection';
import PeriodComparisonCard from '../components/PeriodComparisonCard';
import ComparisonChart from '../components/ComparisonChart';
import { usePeriodComparison } from '../hooks/usePeriodComparison';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan } from '../utils/dateUtils';
import { toast } from 'sonner';

const StatCard = ({ title, value, icon: Icon, color, change, changeType, onClick }) => (
  <div
    className={`bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-2.5 xl:p-3 2xl:p-4 h-full min-w-0 ${onClick ? 'cursor-pointer hover:border-gray-300 hover:shadow-md transition-all' : ''}`}
    onClick={onClick}
  >
    <div className="text-center flex flex-col justify-center items-center h-full">
      <div className="flex justify-center mb-1 sm:mb-1.5 xl:mb-2 2xl:mb-3">
        <div className={`p-1.5 sm:p-2 xl:p-2.5 2xl:p-3 rounded-full ${color}`}>
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 text-white" />
        </div>
      </div>
      <p className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-600 mb-0.5 sm:mb-1 line-clamp-2">{title}</p>
      <p className="text-sm sm:text-base xl:text-lg 2xl:text-xl font-semibold text-gray-900 mb-0.5 sm:mb-1 break-words">{value}</p>
      <div className="h-3 sm:h-4 flex items-center justify-center space-x-0.5">
        {change && (
          <>
            {changeType === 'positive' && (
              <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            )}
            <p className={`text-[10px] sm:text-xs font-medium ${changeType === 'positive' ? 'text-green-600' : 'text-gray-600'}`}>
              {changeType === 'positive' ? '+' : ''}{change}
            </p>
          </>
        )}
      </div>
    </div>
  </div>
);

const DASHBOARD_HIDDEN_KEY = 'dashboardDataHidden';
const LOW_STOCK_THRESHOLD = 5;

export const Dashboard = () => {
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
    } catch (_) { }
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
  const [showAllReceiptsModal, setShowAllReceiptsModal] = useState(false);
  const [showAllPaymentsModal, setShowAllPaymentsModal] = useState(false);
  const [showDiscountsModal, setShowDiscountsModal] = useState(false);
  const [showLowStockModal, setShowLowStockModal] = useState(false);

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
    pollingInterval: 60000,
  });

  if (todaySummaryError) {
    console.error('Today Summary Error:', todaySummaryError);
  }

  const { data: lowStockData, isLoading: lowStockLoading } = useGetLowStockItemsQuery();
  const { data: lowStockAlertsData, isLoading: lowStockAlertsLoading } = useGetLowStockAlertsQuery(
    {
      includeOutOfStock: true,
      includeCritical: true,
      includeWarning: true,
      page: 1,
      limit: 5000,
    },
    {
      pollingInterval: 30000,
    }
  );
  const { data: alertSummaryData } = useGetAlertSummaryQuery(undefined, {
    pollingInterval: 30000,
  });

  const { data: inventoryData, isLoading: inventoryLoading } = useGetInventorySummaryQuery();

  const { data: customersData, isLoading: customersLoading } = useGetCustomersQuery(
    { status: 'active', limit: 1, page: 1 }
  );

  const { data: rangeSummaryRes, isLoading: rangeSummaryLoading } = useGetDashboardRangeSummaryQuery(
    { dateFrom: startDate, dateTo: endDate },
    {
      skip: !startDate || !endDate,
      refetchOnMountOrArgChange: true,
      pollingInterval: 120000,
    }
  );

  const [fetchSalesOrdersModal, soModalState] = useLazyGetSalesOrdersQuery();
  const [fetchPurchaseOrdersModal, poModalState] = useLazyGetPurchaseOrdersQuery();
  const [confirmSalesOrderMutation, { isLoading: confirmingSalesOrder }] = useConfirmSalesOrderMutation();
  const [cancelSalesOrderMutation, { isLoading: cancellingSalesOrder }] = useCancelSalesOrderMutation();
  const [confirmPurchaseOrderMutation, { isLoading: confirmingPurchaseOrder }] = useConfirmPurchaseOrderMutation();
  const [cancelPurchaseOrderMutation, { isLoading: cancellingPurchaseOrder }] = useCancelPurchaseOrderMutation();
  const [fetchSalesInvoicesModal, siModalState] = useLazyGetOrdersQuery();
  const [fetchPurchaseInvoicesModal, piModalState] = useLazyGetPurchaseInvoicesQuery();
  const [fetchCashReceiptsModal, crModalState] = useLazyGetCashReceiptsQuery();
  const [fetchCashPaymentsModal, cpModalState] = useLazyGetCashPaymentsQuery();
  const [fetchBankReceiptsModal, brModalState] = useLazyGetBankReceiptsQuery();
  const [fetchBankPaymentsModal, bpModalState] = useLazyGetBankPaymentsQuery();

  const rangeParams = { dateFrom: startDate, dateTo: endDate, all: true };
  useEffect(() => {
    if (!startDate || !endDate) return;
    if (showSalesOrdersModal) fetchSalesOrdersModal(rangeParams);
  }, [showSalesOrdersModal, startDate, endDate, fetchSalesOrdersModal]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    if (showPurchaseOrdersModal) fetchPurchaseOrdersModal(rangeParams);
  }, [showPurchaseOrdersModal, startDate, endDate, fetchPurchaseOrdersModal]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    if (showSalesInvoicesModal || showAllReceiptsModal || showDiscountsModal) fetchSalesInvoicesModal(rangeParams);
  }, [showSalesInvoicesModal, showAllReceiptsModal, showDiscountsModal, startDate, endDate, fetchSalesInvoicesModal]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    if (showPurchaseInvoicesModal) fetchPurchaseInvoicesModal(rangeParams);
  }, [showPurchaseInvoicesModal, startDate, endDate, fetchPurchaseInvoicesModal]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    if (showCashReceiptsModal || showAllReceiptsModal) fetchCashReceiptsModal(rangeParams);
  }, [showCashReceiptsModal, showAllReceiptsModal, startDate, endDate, fetchCashReceiptsModal]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    if (showCashPaymentsModal || showAllPaymentsModal) fetchCashPaymentsModal(rangeParams);
  }, [showCashPaymentsModal, showAllPaymentsModal, startDate, endDate, fetchCashPaymentsModal]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    if (showBankReceiptsModal || showAllReceiptsModal) fetchBankReceiptsModal(rangeParams);
  }, [showBankReceiptsModal, showAllReceiptsModal, startDate, endDate, fetchBankReceiptsModal]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    if (showBankPaymentsModal || showAllPaymentsModal) fetchBankPaymentsModal(rangeParams);
  }, [showBankPaymentsModal, showAllPaymentsModal, startDate, endDate, fetchBankPaymentsModal]);

  const { data: recurringExpensesData, isLoading: recurringExpensesLoading } = useGetUpcomingExpensesQuery(
    { days: 14 },
    { pollingInterval: 120000 }
  );

  const { data: plSummaryData } = useGetSummaryQuery(
    { startDate, endDate },
    { skip: !startDate || !endDate }
  );

  const { data: companySettingsData } = useGetCompanySettingsQuery();
  const { data: companyData } = useFetchCompanyQuery();

  if (summaryLoading || lowStockLoading || lowStockAlertsLoading || inventoryLoading || customersLoading || rangeSummaryLoading || recurringExpensesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Handle different response structures from RTK Query
  // RTK Query wraps responses in 'data', but some APIs return data directly
  const summary = todaySummary?.data?.summary || todaySummary?.summary || {};
  const inventorySummary =
    inventoryData?.data?.summary ??
    inventoryData?.data ??
    inventoryData?.summary ??
    inventoryData ??
    {};
  const inventoryAlertsSummary =
    alertSummaryData?.data?.data ??
    alertSummaryData?.data ??
    alertSummaryData ??
    {};
  const customersPagination = customersData?.pagination ?? customersData?.data?.pagination;
  const activeCustomersCount =
    customersPagination?.total ??
    customersData?.data?.customers?.length ??
    customersData?.customers?.length ??
    0;

  const agg = rangeSummaryRes?.data ?? rangeSummaryRes ?? {};

  const pickList = (payload, keys) => {
    if (!payload) return [];
    const inner = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? payload.data
      : payload;
    for (const k of keys) {
      const v = inner[k];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const pendingSalesOrdersCount = agg.pendingSalesOrdersCount ?? 0;
  const pendingPurchaseOrdersCount = agg.pendingPurchaseOrdersCount ?? 0;
  const cashReceiptsCount = agg.cashReceipts?.count ?? 0;
  const cashPaymentsCount = agg.cashPayments?.count ?? 0;
  const bankReceiptsCount = agg.bankReceipts?.count ?? 0;
  const bankPaymentsCount = agg.bankPayments?.count ?? 0;

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

  const salesOrdersTotal = Number(agg.salesOrdersInRange?.sumTotal) || 0;
  const purchaseOrdersTotal = Number(agg.purchaseOrdersInRange?.sumTotal) || 0;
  const salesInvoicesTotal = Number(agg.salesInvoicesInRange?.sumTotal) || 0;
  const salesInvoicesCOGS = Number(agg.salesInvoicesInRange?.sumCogs) || 0;
  const purchaseInvoicesTotal = Number(agg.purchaseInvoicesInRange?.sumTotal) || 0;

  const cashReceiptsTotal = Number(agg.cashReceipts?.sumAmount) || 0;
  const cashPaymentsTotal = Number(agg.cashPayments?.sumAmount) || 0;
  const bankReceiptsTotal = Number(agg.bankReceipts?.sumAmount) || 0;
  const bankPaymentsTotal = Number(agg.bankPayments?.sumAmount) || 0;

  const cashReceiptsArray = pickList(crModalState.data, ['cashReceipts']);
  const cashPaymentsArray = pickList(cpModalState.data, ['cashPayments']);
  const bankReceiptsArray = pickList(brModalState.data, ['bankReceipts']);
  const bankPaymentsArray = pickList(bpModalState.data, ['bankPayments']);
  const salesInvoicesArray = pickList(siModalState.data, ['orders']);
  const salesOrdersArray = pickList(soModalState.data, ['salesOrders']);

  // Calculate total sales (Sales Orders + Sales Invoices)
  const totalSales = salesOrdersTotal + salesInvoicesTotal;

  // Calculate total purchases (Purchase Orders + Purchase Invoices) - COGS
  const totalPurchases = purchaseOrdersTotal + purchaseInvoicesTotal;

  const salesOrdersDiscounts = Number(agg.salesOrdersInRange?.sumDiscount) || 0;
  const salesInvoicesDiscounts = Number(agg.salesInvoicesInRange?.sumDiscount) || 0;
  const totalDiscounts = salesOrdersDiscounts + salesInvoicesDiscounts;

  // Sales Returns from P&L (account 4100)
  const totalSalesReturns = plSummaryData?.data?.returns?.salesReturns ?? plSummaryData?.returns?.salesReturns ?? 0;

  // Total Revenue = Sales Revenue - Sales Returns + Other Income (matches P&L)
  const salesRevenue = plSummaryData?.data?.revenue?.salesRevenue ?? plSummaryData?.revenue?.salesRevenue ?? totalSales;
  const otherIncome = plSummaryData?.data?.revenue?.otherIncome ?? plSummaryData?.revenue?.otherIncome ?? 0;
  const totalRevenue = salesRevenue - totalSalesReturns + otherIncome;
  // Total Sale Net Profit = Total Revenue - COGS (matches P&L; must subtract returns before COGS)
  const salesInvoicesNetProfit = totalRevenue - salesInvoicesCOGS;

  const operatingExpenses =
    (Number(agg.cashPayments?.sumOperating) || 0) + (Number(agg.bankPayments?.sumOperating) || 0);

  const totalCashPayments = cashPaymentsTotal;
  const totalBankPayments = bankPaymentsTotal;
  const totalPayments = totalCashPayments + totalBankPayments; // Includes both supplier payments and expenses

  const salesInvoicePayments = Number(agg.salesInvoicesInRange?.sumAmountPaid) || 0;

  // Cash Flow Calculations
  const totalCashReceipts = cashReceiptsTotal;
  const totalBankReceipts = bankReceiptsTotal;
  // Total Receipts includes: Cash Receipts + Bank Receipts + Sales Invoice Payments
  const totalReceipts = totalCashReceipts + totalBankReceipts + salesInvoicePayments;
  const netCashFlow = totalReceipts - totalPayments;

  // Financial Performance Calculations
  const grossRevenue = totalSales; // Total sales before discounts
  const netRevenue = totalSales - totalDiscounts - totalSalesReturns; // Sales after discounts and returns
  // Use COGS from P&L (cost of goods SOLD) - NOT totalPurchases (cost of goods bought). Purchases ≠ COGS.
  const costOfGoodsSold = plSummaryData?.data?.costOfGoodsSold?.total ?? plSummaryData?.costOfGoodsSold?.total ?? totalPurchases;
  // Gross Profit must match P&L: use P&L summary revenue and COGS (same period). Dashboard was wrong because it used
  // totalSales (Sales Orders + Sales Invoices) for revenue while P&L uses only invoiced sales minus returns.
  const plRevenueTotal = plSummaryData?.data?.revenue?.total ?? plSummaryData?.revenue?.total;
  const plCogsTotal = plSummaryData?.data?.costOfGoodsSold?.total ?? plSummaryData?.costOfGoodsSold?.total;
  const grossProfit =
    plRevenueTotal != null && plCogsTotal != null
      ? plRevenueTotal - plCogsTotal
      : (plSummaryData?.data?.grossProfit ?? plSummaryData?.grossProfit ?? (netRevenue - costOfGoodsSold));
  const netProfit = grossProfit - operatingExpenses;

  // Column definitions for modals
  const salesOrdersColumns = [
    {
      key: 'soNumber',
      label: 'Order Number',
      sortable: true,
      render: (val, row) => val || row.so_number || row.orderNumber || row.order_number || row.invoiceNumber || '-'
    },
    { key: 'customer', label: 'Customer', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.business_name || row.customer?.displayName || row.customer?.name || '-' },
    {
      key: 'orderDate',
      label: 'Date',
      sortable: true,
      format: 'date',
      render: (val, row) => formatDate(val || row.order_date || row.createdAt || row.created_at || row.date)
    },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'total', label: 'Total', sortable: true, format: 'currency' }
  ];

  const purchaseOrdersColumns = [
    {
      key: 'poNumber',
      label: 'PO Number',
      sortable: true,
      render: (val, row) => val || row.purchase_order_number || row.po_number || row.orderNumber || row.order_number || row.referenceNumber || '-'
    },
    { key: 'supplier', label: 'Supplier', sortable: true, render: (val, row) => row.supplier?.businessName || row.supplier?.business_name || row.supplier?.companyName || row.supplier?.displayName || row.supplier?.name || '-' },
    {
      key: 'orderDate',
      label: 'Date',
      sortable: true,
      format: 'date',
      render: (val, row) => formatDate(val || row.purchase_date || row.order_date || row.createdAt || row.created_at || row.date)
    },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'total', label: 'Total', sortable: true, format: 'currency' }
  ];

  const salesInvoicesColumns = [
    { key: 'order_number', label: 'Order Number', sortable: true, render: (val, row) => val || row.orderNumber || row.invoiceNo || '-' },
    { key: 'customer', label: 'Customer', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.business_name || row.customerInfo?.businessName || row.customerInfo?.business_name || row.customerName || row.customer?.name || row.customerInfo?.name || '-' },
    { key: 'sale_date', label: 'Date', sortable: true, format: 'date', render: (val, row) => formatDate(val || row.createdAt || row.orderDate || row.date) },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'total', label: 'Total', sortable: true, render: (val, row) => formatCurrency(val !== undefined && val !== null ? val : (row.pricing?.total || 0)) }
  ];

  const salesDiscountsColumns = [
    { key: 'order_number', label: 'Order Number', sortable: true, render: (val, row) => val || row.orderNumber || row.invoiceNo || '-' },
    { key: 'customer', label: 'Customer', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.business_name || row.customerInfo?.businessName || row.customerInfo?.business_name || row.customerName || row.customer?.name || row.customerInfo?.name || '-' },
    { key: 'sale_date', label: 'Date', sortable: true, format: 'date', render: (val, row) => formatDate(val || row.createdAt || row.orderDate || row.date) },
    {
      key: 'discount_amount',
      label: 'Discount',
      sortable: true,
      render: (val, row) => {
        const discountValue = Number(
          row.discountAmount ??
          row.discount_amount ??
          row.pricing?.discountAmount ??
          row.pricing?.discount ??
          0
        ) || 0;
        return formatCurrency(discountValue);
      }
    },
    { key: 'total', label: 'Total', sortable: true, render: (val, row) => formatCurrency(val !== undefined && val !== null ? val : (row.pricing?.total || 0)) }
  ];

  const purchaseInvoicesColumns = [
    { key: 'invoice_number', label: 'Invoice Number', sortable: true, render: (val, row) => val || row.invoiceNumber || '-' },
    { key: 'supplier', label: 'Supplier', sortable: true, render: (val, row) => row.supplier?.businessName || row.supplier?.business_name || row.supplier?.companyName || row.supplier?.displayName || row.supplier?.name || '-' },
    { key: 'invoice_date', label: 'Date', sortable: true, format: 'date', render: (val, row) => formatDate(val || row.invoiceDate || row.createdAt) },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'total', label: 'Total', sortable: true, render: (val, row) => formatCurrency(val !== undefined && val !== null ? val : (row.pricing?.total || 0)) }
  ];

  const cashReceiptsColumns = [
    { key: 'voucherCode', label: 'Voucher Code', sortable: true, render: (val, row) => val || row.receipt_number || '-' },
    { key: 'customer', label: 'Customer/Supplier', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.business_name || row.customer?.displayName || row.customer?.name || row.supplier?.businessName || row.supplier?.business_name || row.supplier?.companyName || row.supplier?.displayName || row.supplier?.name || '-' },
    { key: 'date', label: 'Date', sortable: true, format: 'date' },
    { key: 'particular', label: 'Particular', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, format: 'currency' }
  ];

  const allReceiptsColumns = [
    { key: 'voucherCode', label: 'Voucher Code', sortable: true, render: (val, row) => val || row.receipt_number || '-' },
    { key: 'type', label: 'Type', sortable: true, render: (val, row) => row.receiptType || 'Cash' },
    { key: 'bankName', label: 'Bank Name', sortable: true, render: (val, row) => row.receiptType === 'Bank' ? (row.bankName || row.bank?.bankName || row.bank_name || '-') : '-' },
    { key: 'customer', label: 'Customer/Supplier', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.business_name || row.customer?.displayName || row.customer?.name || row.supplier?.businessName || row.supplier?.business_name || row.supplier?.companyName || row.supplier?.displayName || row.supplier?.name || '-' },
    { key: 'date', label: 'Date', sortable: true, format: 'date' },
    { key: 'particular', label: 'Particular', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, format: 'currency' }
  ];

  const cashPaymentsColumns = [
    { key: 'voucherCode', label: 'Voucher Code', sortable: true, render: (val, row) => val || row.payment_number || '-' },
    { key: 'supplier', label: 'Supplier', sortable: true, render: (val, row) => row.supplier?.businessName || row.supplier?.business_name || row.supplier?.companyName || row.supplier?.displayName || row.supplier?.name || '-' },
    { key: 'customer', label: 'Customer', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.business_name || row.customer?.displayName || row.customer?.name || '-' },
    { key: 'date', label: 'Date', sortable: true, format: 'date' },
    { key: 'particular', label: 'Particular', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, format: 'currency' }
  ];

  const allPaymentsColumns = [
    { key: 'voucherCode', label: 'Voucher Code', sortable: true, render: (val, row) => val || row.payment_number || '-' },
    { key: 'type', label: 'Type', sortable: true, render: (val, row) => row.paymentType || 'Cash' },
    { key: 'supplier', label: 'Supplier', sortable: true, render: (val, row) => row.supplier?.businessName || row.supplier?.business_name || row.supplier?.companyName || row.supplier?.displayName || row.supplier?.name || '-' },
    { key: 'customer', label: 'Customer', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.business_name || row.customer?.displayName || row.customer?.name || '-' },
    { key: 'date', label: 'Date', sortable: true, format: 'date' },
    { key: 'particular', label: 'Particular', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, format: 'currency' }
  ];

  const bankReceiptsColumns = [
    { key: 'voucherCode', label: 'Voucher Code', sortable: true, render: (val, row) => val || row.receipt_number || '-' },
    { key: 'bankName', label: 'Bank Name', sortable: true, render: (val, row) => row.bankName || row.bank?.bankName || row.bank_name || '-' },
    { key: 'customer', label: 'Customer/Supplier', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.business_name || row.customer?.displayName || row.customer?.name || row.supplier?.businessName || row.supplier?.business_name || row.supplier?.companyName || row.supplier?.displayName || row.supplier?.name || '-' },
    { key: 'date', label: 'Date', sortable: true, format: 'date' },
    { key: 'particular', label: 'Particular', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, format: 'currency' }
  ];

  const bankPaymentsColumns = [
    { key: 'voucherCode', label: 'Voucher Code', sortable: true, render: (val, row) => val || row.payment_number || '-' },
    { key: 'supplier', label: 'Supplier', sortable: true, render: (val, row) => row.supplier?.businessName || row.supplier?.business_name || row.supplier?.companyName || row.supplier?.displayName || row.supplier?.name || '-' },
    { key: 'customer', label: 'Customer', sortable: true, render: (val, row) => row.customer?.businessName || row.customer?.business_name || row.customer?.displayName || row.customer?.name || '-' },
    { key: 'date', label: 'Date', sortable: true, format: 'date' },
    { key: 'particular', label: 'Particular', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, format: 'currency' }
  ];

  const getLowStockProductName = (row) =>
    row.name ??
    row.productName ??
    row.product_name ??
    row.product?.name ??
    row.product?.displayName ??
    '-';

  const getLowStockSku = (row) =>
    row.sku ??
    row.productCode ??
    row.product_code ??
    row.product?.sku ??
    row.product?.code ??
    '-';

  const getLowStockCurrentStock = (row) =>
    Number(
      row.currentStock ??
      row.current_stock ??
      row.stockQuantity ??
      row.stock_quantity ??
      row.inventory?.currentStock ??
      row.inventory?.current_stock ??
      row.metrics?.currentStock ??
      row.metrics?.current_stock ??
      0
    );

  const getLowStockReorderPoint = (row) =>
    Number(
      row.reorderPoint ??
      row.reorder_point ??
      row.minStock ??
      row.min_stock ??
      row.inventory?.reorderPoint ??
      row.inventory?.reorder_point ??
      row.metrics?.reorderPoint ??
      row.metrics?.reorder_point ??
      0
    );

  const lowStockItemsColumns = [
    {
      key: 'name',
      label: 'Product',
      sortable: true,
      render: (_val, row) => getLowStockProductName(row)
    },
    {
      key: 'sku',
      label: 'SKU',
      sortable: true,
      render: (_val, row) => getLowStockSku(row)
    },
    {
      key: 'current_stock',
      label: 'Current Stock',
      sortable: true,
      render: (_val, row) => getLowStockCurrentStock(row)
    },
    {
      key: 'reorder_point',
      label: 'Reorder Point',
      sortable: true,
      render: (_val, row) => getLowStockReorderPoint(row)
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_val, row) => {
        const current = getLowStockCurrentStock(row);
        return current < LOW_STOCK_THRESHOLD ? `Low Stock (< ${LOW_STOCK_THRESHOLD})` : 'Normal';
      }
    }
  ];

  const purchaseInvoicesDataArray = pickList(piModalState.data, ['invoices']);
  const salesOrdersModalData = salesOrdersArray;
  const purchaseOrdersModalData = pickList(poModalState.data, ['purchaseOrders']);
  const salesInvoicesModalData = salesInvoicesArray;
  const salesDiscountsDataArray = salesInvoicesArray.filter((row) => {
    const discountValue = Number(
      row.discountAmount ??
      row.discount_amount ??
      row.pricing?.discountAmount ??
      row.pricing?.discount ??
      0
    ) || 0;
    return discountValue > 0;
  });
  const cashReceiptsDataArray = cashReceiptsArray;
  const cashPaymentsDataArray = cashPaymentsArray;
  const bankReceiptsDataArray = bankReceiptsArray;
  const bankPaymentsDataArray = bankPaymentsArray;
  const lowStockAlertsArrayRaw =
    lowStockAlertsData?.data?.data ||
    lowStockAlertsData?.data ||
    lowStockAlertsData ||
    [];
  const lowStockItemsDataArray = (Array.isArray(lowStockAlertsArrayRaw) ? lowStockAlertsArrayRaw : []).filter((row) => {
    const current = getLowStockCurrentStock(row);
    return current < LOW_STOCK_THRESHOLD;
  });
  const lowStockCount = lowStockItemsDataArray.length;

  // Combined receipts and payments data (cash + bank + sales invoice payments)
  const salesInvoiceReceiptsArray = salesInvoicesArray
    .filter(sale => {
      const amountPaid = Number(sale.amount_paid || sale.amountPaid || 0);
      return amountPaid > 0; // Only include sales with payments
    })
    .map(sale => ({
      voucherCode: sale.order_number || sale.orderNumber || '-',
      receiptType: 'Sales Invoice',
      customer: sale.customer || sale.customerInfo,
      date: sale.sale_date || sale.saleDate || sale.created_at || sale.createdAt,
      particular: `Payment for Sale: ${sale.order_number || sale.orderNumber || 'N/A'}`,
      amount: Number(sale.amount_paid || sale.amountPaid || 0)
    }));

  const allReceiptsDataArray = [
    ...cashReceiptsArray.map(r => ({ ...r, receiptType: 'Cash' })),
    ...bankReceiptsArray.map(r => ({ ...r, receiptType: 'Bank' })),
    ...salesInvoiceReceiptsArray
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const allPaymentsDataArray = [
    ...cashPaymentsArray.map(p => ({ ...p, paymentType: 'Cash' })),
    ...bankPaymentsArray.map(p => ({ ...p, paymentType: 'Bank' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const companyInfo = companySettingsData?.data?.data ?? companySettingsData?.data ?? {};
  const companyFromApi = companyData?.data || companyData || {};
  const companyLogo = companyFromApi.logo || companyInfo.logo;
  const companyName = companyInfo.companyName || companyInfo.businessName || companyFromApi.companyName || '';
  const dashboardLogoSizeRaw = Number(companyInfo?.orderSettings?.dashboardLogoSize);
  const dashboardLogoSize = Number.isFinite(dashboardLogoSizeRaw)
    ? Math.min(900, Math.max(120, dashboardLogoSizeRaw))
    : 500;

  const getRowOrderId = (row) => row?.id || row?._id;

  const handleConfirmPendingSalesOrder = async (row) => {
    const id = getRowOrderId(row);
    if (!id) {
      toast.error('Sales order id not found');
      return;
    }
    if (!window.confirm('Confirm this sales order? This will generate invoice and update stock.')) {
      return;
    }
    try {
      await confirmSalesOrderMutation(id).unwrap();
      toast.success('Sales order confirmed successfully');
      fetchSalesOrdersModal(rangeParams);
      fetchSalesInvoicesModal(rangeParams);
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to confirm sales order');
    }
  };

  const handleCancelPendingSalesOrder = async (row) => {
    const id = getRowOrderId(row);
    if (!id) {
      toast.error('Sales order id not found');
      return;
    }
    if (!window.confirm('Cancel this sales order? This action cannot be undone.')) {
      return;
    }
    try {
      await cancelSalesOrderMutation(id).unwrap();
      toast.success('Sales order cancelled successfully');
      fetchSalesOrdersModal(rangeParams);
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to cancel sales order');
    }
  };

  const handleConfirmPendingPurchaseOrder = async (row) => {
    const id = getRowOrderId(row);
    if (!id) {
      toast.error('Purchase order id not found');
      return;
    }
    if (!window.confirm('Confirm this purchase order? Inventory will be updated and invoice may be created.')) {
      return;
    }
    try {
      await confirmPurchaseOrderMutation(id).unwrap();
      toast.success('Purchase order confirmed successfully');
      fetchPurchaseOrdersModal(rangeParams);
      fetchPurchaseInvoicesModal(rangeParams);
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to confirm purchase order');
    }
  };

  const handleCancelPendingPurchaseOrder = async (row) => {
    const id = getRowOrderId(row);
    if (!id) {
      toast.error('Purchase order id not found');
      return;
    }
    if (!window.confirm('Cancel this purchase order? This action cannot be undone.')) {
      return;
    }
    try {
      await cancelPurchaseOrderMutation(id).unwrap();
      toast.success('Purchase order cancelled successfully');
      fetchPurchaseOrdersModal(rangeParams);
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to cancel purchase order');
    }
  };

  const isPendingSalesRow = (row) => {
    const normalizedStatus = (row?.status || '').toLowerCase().trim();
    return normalizedStatus === 'draft' || normalizedStatus === 'pending';
  };

  const isCompletedSalesRow = (row) => {
    const normalizedStatus = (row?.status || '').toLowerCase().trim();
    return normalizedStatus === 'confirmed' || normalizedStatus === 'partially_invoiced' || normalizedStatus === 'fully_invoiced';
  };

  const isCancelledSalesRow = (row) => {
    const normalizedStatus = (row?.status || '').toLowerCase().trim();
    return normalizedStatus === 'cancelled';
  };

  const isPendingPurchaseRow = (row) => {
    const normalizedStatus = (row?.status || '').toLowerCase().trim();
    return normalizedStatus === 'draft' || normalizedStatus === 'pending';
  };

  const isCompletedPurchaseRow = (row) => {
    const normalizedStatus = (row?.status || '').toLowerCase().trim();
    return normalizedStatus === 'confirmed' || normalizedStatus === 'partially_received' || normalizedStatus === 'fully_received';
  };

  const isCancelledPurchaseRow = (row) => {
    const normalizedStatus = (row?.status || '').toLowerCase().trim();
    return normalizedStatus === 'cancelled';
  };

  const pendingSalesRowActions = [
    {
      label: confirmingSalesOrder ? 'Confirming...' : 'Confirm Invoice',
      className: 'h-7 px-2 text-[10px] sm:text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50',
      isVisible: isPendingSalesRow,
      isDisabled: () => confirmingSalesOrder || cancellingSalesOrder,
      onClick: handleConfirmPendingSalesOrder
    },
    {
      label: cancellingSalesOrder ? 'Cancelling...' : 'Cancel Invoice',
      className: 'h-7 px-2 text-[10px] sm:text-xs border-red-200 text-red-700 hover:bg-red-50',
      isVisible: isPendingSalesRow,
      isDisabled: () => confirmingSalesOrder || cancellingSalesOrder,
      onClick: handleCancelPendingSalesOrder
    },
    {
      label: 'Invoice Complete',
      variant: 'ghost',
      className: 'h-7 px-2 text-[10px] sm:text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 cursor-default',
      isVisible: isCompletedSalesRow,
      isDisabled: () => true,
      onClick: () => {}
    },
    {
      label: 'Invoice Cancel',
      variant: 'ghost',
      className: 'h-7 px-2 text-[10px] sm:text-xs text-red-700 bg-red-50 border border-red-200 cursor-default',
      isVisible: isCancelledSalesRow,
      isDisabled: () => true,
      onClick: () => {}
    }
  ];

  const pendingPurchaseRowActions = [
    {
      label: confirmingPurchaseOrder ? 'Confirming...' : 'Confirm Invoice',
      className: 'h-7 px-2 text-[10px] sm:text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50',
      isVisible: isPendingPurchaseRow,
      isDisabled: () => confirmingPurchaseOrder || cancellingPurchaseOrder,
      onClick: handleConfirmPendingPurchaseOrder
    },
    {
      label: cancellingPurchaseOrder ? 'Cancelling...' : 'Cancel Invoice',
      className: 'h-7 px-2 text-[10px] sm:text-xs border-red-200 text-red-700 hover:bg-red-50',
      isVisible: isPendingPurchaseRow,
      isDisabled: () => confirmingPurchaseOrder || cancellingPurchaseOrder,
      onClick: handleCancelPendingPurchaseOrder
    },
    {
      label: 'Invoice Complete',
      variant: 'ghost',
      className: 'h-7 px-2 text-[10px] sm:text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 cursor-default',
      isVisible: isCompletedPurchaseRow,
      isDisabled: () => true,
      onClick: () => {}
    },
    {
      label: 'Invoice Cancel',
      variant: 'ghost',
      className: 'h-7 px-2 text-[10px] sm:text-xs text-red-700 bg-red-50 border border-red-200 cursor-default',
      isVisible: isCancelledPurchaseRow,
      isDisabled: () => true,
      onClick: () => {}
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Dashboard</h1>
          {!dashboardHidden && (
            <p className="hidden sm:block text-sm sm:text-base text-gray-600">Welcome back! Here's what's happening today.</p>
          )}
        </div>

        {/* Hide Data Button - Mobile only (no date filter here to save space) */}
        <div className="flex items-center justify-end gap-2 flex-shrink-0 lg:hidden">
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
          {!dashboardHidden && (
            <DateFilter
              startDate={startDate}
              endDate={endDate}
              onDateChange={handleDateChange}
              compact={true}
              showPresets={true}
              className="w-full"
            />
          )}
          <button
            type="button"
            onClick={toggleDashboardVisibility}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-xs sm:text-sm font-medium transition-colors flex-shrink-0 whitespace-nowrap"
            title={dashboardHidden ? 'Show dashboard data' : 'Hide dashboard data'}
          >
            {dashboardHidden ? (
              <>
                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Show data</span>
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
        <div className="min-h-[70vh] flex flex-col items-center justify-center bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <div className="flex flex-col items-center gap-8 w-full text-center">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName || 'Company logo'}
                crossOrigin="anonymous"
                className="w-auto max-w-full object-contain transition-all duration-500 hover:scale-105"
                style={{ height: `${dashboardLogoSize}px` }}
              />
            ) : (
              <div className="w-60 h-60 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Building className="h-32 w-32 text-gray-400" />
              </div>
            )}
            {companyName ? (
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">{companyName}</h2>
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

              {/* REVENUE, COST & DISCOUNT SECTION - Responsive scaling */}
              <div>
                <h3 className="text-[10px] sm:text-xs xl:text-sm font-semibold text-gray-700 mb-2 xl:mb-3 uppercase tracking-wide">Revenue, Cost & Discounts</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2 xl:gap-3 2xl:gap-4">

                  {/* Sales */}
                  <div
                    className="text-center p-2 sm:p-2.5 xl:p-3 2xl:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors relative group shadow-sm min-w-0"
                    onClick={() => setShowSalesInvoicesModal(true)}
                  >
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="h-2.5 w-2.5 xl:h-3 xl:w-3 2xl:h-4 2xl:w-4 text-gray-600" />
                    </div>
                    <div className="flex justify-center mb-1 sm:mb-1.5 xl:mb-2">
                      <div className="p-1.5 sm:p-2 xl:p-2.5 2xl:p-3 bg-green-500 rounded-full">
                        <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Sales (Revenue)</p>
                    <p className="text-sm sm:text-base xl:text-lg 2xl:text-xl font-bold text-gray-900 break-words">{Math.round(totalSales).toLocaleString()}</p>
                    <p className="text-[9px] sm:text-[10px] xl:text-xs text-gray-500 mt-0.5 hidden sm:block">SO: {Math.round(salesOrdersTotal)} | SI: {Math.round(salesInvoicesTotal)}</p>
                    <p className="text-[9px] sm:text-[10px] xl:text-xs text-primary-600 font-medium mt-0.5">Net: {Math.round(netRevenue).toLocaleString()}</p>
                  </div>

                  {/* Purchase (COGS) */}
                  <div
                    className="text-center p-2 sm:p-2.5 xl:p-3 2xl:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors relative group shadow-sm min-w-0"
                    onClick={() => setShowPurchaseInvoicesModal(true)}
                  >
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="h-2.5 w-2.5 xl:h-3 xl:w-3 2xl:h-4 2xl:w-4 text-gray-600" />
                    </div>
                    <div className="flex justify-center mb-1 sm:mb-1.5 xl:mb-2">
                      <div className="p-1.5 sm:p-2 xl:p-2.5 2xl:p-3 bg-purple-500 rounded-full">
                        <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Purchase (COGS)</p>
                    <p className="text-sm sm:text-base xl:text-lg 2xl:text-xl font-bold text-gray-900 break-words">{Math.round(totalPurchases).toLocaleString()}</p>
                    <p className="text-[9px] sm:text-[10px] xl:text-xs text-gray-500 mt-0.5 hidden sm:block">PO: {Math.round(purchaseOrdersTotal)} | PI: {Math.round(purchaseInvoicesTotal)}</p>
                  </div>

                  {/* Discount */}
                  <div
                    className="text-center p-2 sm:p-2.5 xl:p-3 2xl:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors relative group shadow-sm min-w-0"
                    onClick={() => setShowDiscountsModal(true)}
                  >
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="h-2.5 w-2.5 xl:h-3 xl:w-3 2xl:h-4 2xl:w-4 text-gray-600" />
                    </div>
                    <div className="flex justify-center mb-1 sm:mb-1.5 xl:mb-2">
                      <div className="p-1.5 sm:p-2 xl:p-2.5 2xl:p-3 bg-red-500 rounded-full">
                        <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Discount Given</p>
                    <p className="text-sm sm:text-base xl:text-lg 2xl:text-xl font-bold text-gray-900 break-words">{Math.round(totalDiscounts).toLocaleString()}</p>
                  </div>

                  {/* Pending Sales Orders */}
                  <div
                    className="text-center p-2 sm:p-2.5 xl:p-3 2xl:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm min-w-0"
                    onClick={() => setShowSalesOrdersModal(true)}
                  >
                    <div className="flex justify-center mb-1 sm:mb-1.5 xl:mb-2">
                      <div className="p-1.5 sm:p-2 xl:p-2.5 2xl:p-3 bg-cyan-500 rounded-full">
                        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Pending Sales Orders</p>
                    <p className="text-sm sm:text-base xl:text-lg 2xl:text-xl font-bold text-gray-900 break-words">{pendingSalesOrdersCount}</p>
                  </div>

                  {/* Pending Purchase Orders */}
                  <div
                    className="text-center p-2 sm:p-2.5 xl:p-3 2xl:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm min-w-0"
                    onClick={() => setShowPurchaseOrdersModal(true)}
                  >
                    <div className="flex justify-center mb-1 sm:mb-1.5 xl:mb-2">
                      <div className="p-1.5 sm:p-2 xl:p-2.5 2xl:p-3 bg-indigo-500 rounded-full">
                        <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Pending Purchase Orders</p>
                    <p className="text-sm sm:text-base xl:text-lg 2xl:text-xl font-bold text-gray-900 break-words">{pendingPurchaseOrdersCount}</p>
                  </div>
                </div>
              </div>

              {/* PROFITABILITY & CASH FLOW SECTION - Responsive scaling */}
              <div>
                <h3 className="text-[10px] sm:text-xs xl:text-sm font-semibold text-gray-700 mb-2 xl:mb-3 uppercase tracking-wide">Profitability & Cash Flow</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2 xl:gap-3 2xl:gap-4">

                  {/* Gross Profit */}
                  <div className="text-center p-2 sm:p-2.5 xl:p-3 2xl:p-4 border border-gray-200 bg-white rounded-lg shadow-sm min-w-0">
                    <div className="flex justify-center mb-1 sm:mb-1.5 xl:mb-2">
                      <div className="p-1.5 sm:p-2 xl:p-2.5 2xl:p-3 bg-blue-500 rounded-full">
                        <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Gross Profit</p>
                    <p className={`text-sm sm:text-base xl:text-lg 2xl:text-xl font-bold break-words ${grossProfit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                      {Math.round(grossProfit).toLocaleString()}
                    </p>
                    <p className="text-[9px] sm:text-[10px] xl:text-xs text-gray-500 mt-0.5 hidden sm:block">Revenue - COGS</p>
                  </div>

                  {/* Total Receipts */}
                  <div
                    className="text-center p-2 sm:p-2.5 xl:p-3 2xl:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors relative group shadow-sm min-w-0"
                    onClick={() => setShowAllReceiptsModal(true)}
                  >
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="h-2.5 w-2.5 xl:h-3 xl:w-3 2xl:h-4 2xl:w-4 text-gray-600" />
                    </div>
                    <div className="flex justify-center mb-1 sm:mb-1.5 xl:mb-2">
                      <div className="p-1.5 sm:p-2 xl:p-2.5 2xl:p-3 bg-emerald-500 rounded-full">
                        <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Total Receipts</p>
                    <p className="text-sm sm:text-base xl:text-lg 2xl:text-xl font-bold text-gray-900 break-words">
                      {isNaN(totalReceipts) ? '0' : Math.round(totalReceipts).toLocaleString()}
                    </p>
                    <p className="text-[9px] sm:text-[10px] xl:text-xs text-gray-500 mt-0.5 hidden sm:block">
                      Cash: {isNaN(totalCashReceipts) ? '0' : Math.round(totalCashReceipts)} | Bank: {isNaN(totalBankReceipts) ? '0' : Math.round(totalBankReceipts)} | Sales: {isNaN(salesInvoicePayments) ? '0' : Math.round(salesInvoicePayments)}
                    </p>
                  </div>

                  {/* Total Payments */}
                  <div
                    className="text-center p-2 sm:p-2.5 xl:p-3 2xl:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors relative group shadow-sm min-w-0"
                    onClick={() => setShowAllPaymentsModal(true)}
                  >
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="h-2.5 w-2.5 xl:h-3 xl:w-3 2xl:h-4 2xl:w-4 text-gray-600" />
                    </div>
                    <div className="flex justify-center mb-1 sm:mb-1.5 xl:mb-2">
                      <div className="p-1.5 sm:p-2 xl:p-2.5 2xl:p-3 bg-orange-500 rounded-full">
                        <Banknote className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Total Payments</p>
                    <p className="text-sm sm:text-base xl:text-lg 2xl:text-xl font-bold text-gray-900 break-words">
                      {isNaN(totalPayments) ? '0' : Math.round(totalPayments).toLocaleString()}
                    </p>
                    <p className="text-[9px] sm:text-[10px] xl:text-xs text-gray-500 mt-0.5 hidden sm:block">
                      Cash: {isNaN(totalCashPayments) ? '0' : Math.round(totalCashPayments)} | Bank: {isNaN(totalBankPayments) ? '0' : Math.round(totalBankPayments)}
                    </p>
                  </div>

                  {/* Net Cash Flow */}
                  <div className="text-center p-2 sm:p-2.5 xl:p-3 2xl:p-4 border border-gray-200 bg-white rounded-lg shadow-sm min-w-0">
                    <div className="flex justify-center mb-1 sm:mb-1.5 xl:mb-2">
                      <div className={`p-1.5 sm:p-2 xl:p-2.5 2xl:p-3 rounded-full ${netCashFlow >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                        <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Net Cash Flow</p>
                    <p className={`text-sm sm:text-base xl:text-lg 2xl:text-xl font-bold break-words ${(isNaN(netCashFlow) ? 0 : netCashFlow) >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                      {isNaN(netCashFlow) ? '0' : Math.round(netCashFlow).toLocaleString()}
                    </p>
                    <p className="text-[9px] sm:text-[10px] xl:text-xs text-gray-500 mt-0.5 hidden sm:block">Receipts - Payments</p>
                  </div>

                  {/* Total Orders */}
                  <div className="text-center p-2 sm:p-2.5 xl:p-3 2xl:p-4 border border-gray-200 bg-white rounded-lg shadow-sm min-w-0">
                    <div className="flex justify-center mb-1 sm:mb-1.5 xl:mb-2">
                      <div className="p-1.5 sm:p-2 xl:p-2.5 2xl:p-3 bg-yellow-500 rounded-full">
                        <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Total Transactions</p>
                    <p className="text-sm sm:text-base xl:text-lg 2xl:text-xl font-bold text-gray-900 break-words">{summary.totalOrders || 0}</p>
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
              value={inventorySummary.totalProducts ?? inventorySummary.total_products ?? 0}
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
              onClick={() => setShowLowStockModal(true)}
            />
          </div>

          {/* Period Comparison Section */}
          <div className="card">
            <div className="card-content pt-4">
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
                additionalCards={[
                  {
                    title: "Today's Orders",
                    subtitle: `Retail: ${summary.orderTypes?.retail || 0} | Wholesale: ${summary.orderTypes?.wholesale || 0}`,
                    currentValue: summary.totalOrders || 0,
                    format: 'number',
                    icon: ShoppingCart,
                    iconColor: 'bg-cyan-500',
                    hideComparisonDetails: true
                  },
                  {
                    title: 'Payment Methods Today',
                    subtitle: Object.entries(summary.paymentMethods || {})
                      .slice(0, 2)
                      .map(([method, count]) => `${method.replace('_', ' ')}: ${count}`)
                      .join(' | ') || 'No payments',
                    currentValue: Object.values(summary.paymentMethods || {}).reduce((acc, val) => acc + Number(val || 0), 0),
                    format: 'number',
                    icon: CreditCard,
                    iconColor: 'bg-emerald-500',
                    hideComparisonDetails: true
                  }
                ]}
                fetchFunction={fetchPeriodSummary}
              />
            </div>
          </div>

          {/* Modals */}
          <DashboardReportModal
            isOpen={showSalesOrdersModal}
            onClose={() => setShowSalesOrdersModal(false)}
            title="Sales Orders"
            columns={salesOrdersColumns}
            data={salesOrdersModalData}
            isLoading={soModalState.isFetching}
            rowActions={pendingSalesRowActions}
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
            isLoading={poModalState.isFetching}
            rowActions={pendingPurchaseRowActions}
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
            isLoading={siModalState.isFetching}
            dateFrom={startDate}
            dateTo={endDate}
            onDateChange={(from, to) => {
              setStartDate(from);
              setEndDate(to);
            }}
            summary={[
              { label: 'Sales Revenue', value: salesRevenue },
              { label: 'Sales Returns', value: totalSalesReturns },
              { label: 'Net Total', value: totalSales - totalSalesReturns - totalDiscounts }
            ]}
          />

          <DashboardReportModal
            isOpen={showPurchaseInvoicesModal}
            onClose={() => setShowPurchaseInvoicesModal(false)}
            title="Purchase Invoices"
            columns={purchaseInvoicesColumns}
            data={purchaseInvoicesDataArray}
            isLoading={piModalState.isFetching}
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
            isLoading={crModalState.isFetching}
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
            isLoading={cpModalState.isFetching}
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
            isLoading={brModalState.isFetching}
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
            isLoading={bpModalState.isFetching}
            dateFrom={startDate}
            dateTo={endDate}
            onDateChange={(from, to) => {
              setStartDate(from);
              setEndDate(to);
            }}
          />

          <DashboardReportModal
            isOpen={showAllReceiptsModal}
            onClose={() => setShowAllReceiptsModal(false)}
            title="All Receipts (Cash + Bank + Sales)"
            columns={allReceiptsColumns}
            data={allReceiptsDataArray}
            isLoading={crModalState.isFetching || brModalState.isFetching || siModalState.isFetching}
            dateFrom={startDate}
            dateTo={endDate}
            onDateChange={(from, to) => {
              setStartDate(from);
              setEndDate(to);
            }}
          />

          <DashboardReportModal
            isOpen={showAllPaymentsModal}
            onClose={() => setShowAllPaymentsModal(false)}
            title="All Payments (Cash + Bank)"
            columns={allPaymentsColumns}
            data={allPaymentsDataArray}
            isLoading={cpModalState.isFetching || bpModalState.isFetching}
            dateFrom={startDate}
            dateTo={endDate}
            onDateChange={(from, to) => {
              setStartDate(from);
              setEndDate(to);
            }}
          />

          <DashboardReportModal
            isOpen={showLowStockModal}
            onClose={() => setShowLowStockModal(false)}
            title="Low Stock Items"
            columns={lowStockItemsColumns}
            data={lowStockItemsDataArray}
            isLoading={lowStockAlertsLoading}
            dateFrom={startDate}
            dateTo={endDate}
            onDateChange={(from, to) => {
              setStartDate(from);
              setEndDate(to);
            }}
            summary={[
              { label: 'Low Stock Count', value: lowStockCount }
            ]}
          />

          <DashboardReportModal
            isOpen={showDiscountsModal}
            onClose={() => setShowDiscountsModal(false)}
            title="Discount Given"
            columns={salesDiscountsColumns}
            data={salesDiscountsDataArray}
            isLoading={siModalState.isFetching}
            dateFrom={startDate}
            dateTo={endDate}
            onDateChange={(from, to) => {
              setStartDate(from);
              setEndDate(to);
            }}
            summary={[
              { label: 'Total Discount Given', value: totalDiscounts },
              { label: 'Invoices With Discount', value: salesDiscountsDataArray.length }
            ]}
          />
        </>
      )}
    </div>
  );
};
