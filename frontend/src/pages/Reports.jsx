import React, { useState, useMemo, useEffect } from 'react';
import { useTableRowVirtualizer, getVirtualTablePadding } from '../hooks/useTableRowVirtualizer';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { toast } from 'sonner';
import {
  TrendingUp,
  Users,
  Package,
  RefreshCcw,
  DollarSign,
  ShoppingBag,
  CheckCircle,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Printer,
  Wallet,
  Building2
} from 'lucide-react';
import ExcelExportButton from '../components/ExcelExportButton';
import PdfExportButton from '../components/PdfExportButton';
import {
  useGetSalesReportQuery,
  useGetProductReportQuery,
  useGetCustomerReportQuery,
  useGetInventoryReportQuery,
  useGetSummaryCardsQuery,
  useGetPartyBalanceReportQuery,
  useGetFinancialReportQuery,
  useGetBankCashSummaryQuery,
} from '../store/services/reportsApi';
import { useGetBanksQuery } from '../store/services/banksApi';
import DateFilter from '../components/DateFilter';
import PrintReportModal from '../components/PrintReportModal';
import { getCurrentDatePakistan, getDateDaysAgo } from '../utils/dateUtils';

import { useCompanyInfo } from '../hooks/useCompanyInfo';

export const Reports = () => {
  const { companyInfo: companySettings } = useCompanyInfo();
  const showCostPrice = companySettings.orderSettings?.showCostPrice !== false;
  const [activeTab, setActiveTab] = useState('party-balance');
  const [partyType, setPartyType] = useState('customer');
  const [salesGroupBy, setSalesGroupBy] = useState('daily');
  const [inventoryType, setInventoryType] = useState('stock-summary');
  const [financialType, setFinancialType] = useState('trial-balance');
  const [inventoryProductSearch, setInventoryProductSearch] = useState('');
  const debouncedInventoryProductSearch = useDebouncedValue(inventoryProductSearch, 400);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  /** Party Balances table: client-side paging */
  const [partyBalancePage, setPartyBalancePage] = useState(1);
  const [partyBalancePageSize, setPartyBalancePageSize] = useState(50);
  const [partyPageSize, setPartyPageSize] = useState(50);
  const PARTY_PAGE_SIZES = [50, 100, 200, 500];
  /** Inventory table paging for Stock Summary / Current Stock / Stock Valuation */
  const [stockSummaryPage, setStockSummaryPage] = useState(1);
  const [stockSummaryPageSize, setStockSummaryPageSize] = useState(50);
  const STOCK_SUMMARY_PAGE_SIZES = [50, 100, 200, 500, 2000, 5000];
  const INVENTORY_PAGINATED_TYPES = ['stock-summary', 'summary', 'valuation'];
  const [dateRange, setDateRange] = useState({
    from: getDateDaysAgo(30),
    to: getCurrentDatePakistan()
  });
  const [bankCashFilterMode, setBankCashFilterMode] = useState('month');
  const [bankCashMonth, setBankCashMonth] = useState(getCurrentDatePakistan().slice(0, 7));
  const [bankCashDateRange, setBankCashDateRange] = useState({
    from: getDateDaysAgo(30),
    to: getCurrentDatePakistan()
  });
  const [selectedBankIds, setSelectedBankIds] = useState([]);

  const handleRefresh = () => {
    refetchSummary();
    if (activeTab === 'party-balance') refetchParty();
    if (activeTab === 'sales') refetchSales();
    if (activeTab === 'inventory') refetchInventory();
    if (activeTab === 'financial') refetchFinancial();
    if (activeTab === 'bank-cash') refetchBankCash();
  };


  // Fetch Summary Cards
  const {
    data: summaryData,
    isLoading: summaryLoading,
    refetch: refetchSummary
  } = useGetSummaryCardsQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to
  });

  // Fetch Party Balance Report
  const {
    data: partyReportData,
    isLoading: partyLoading,
    refetch: refetchParty
  } = useGetPartyBalanceReportQuery({
    partyType
  }, {
    skip: activeTab !== 'party-balance'
  });

  const partyBalanceAllRows = useMemo(() => partyReportData?.data || [], [partyReportData?.data]);
  const partyBalanceTotal = partyBalanceAllRows.length;
  const partyBalanceTotalPages = Math.max(1, Math.ceil(partyBalanceTotal / partyPageSize) || 1);

  useEffect(() => {
    setPartyBalancePage(1);
  }, [partyType]);

  useEffect(() => {
    setPartyBalancePage(1);
  }, [partyPageSize]);

  useEffect(() => {
    setPartyBalancePage((p) => Math.min(p, partyBalanceTotalPages));
  }, [partyBalanceTotalPages]);

  const partyBalancePaginatedRows = useMemo(() => {
    const page = Math.min(partyBalancePage, partyBalanceTotalPages);
    const start = (page - 1) * partyPageSize;
    return partyBalanceAllRows.slice(start, start + partyPageSize);
  }, [partyBalanceAllRows, partyBalancePage, partyBalanceTotalPages, partyPageSize]);

  const partyRangeStart = partyBalanceTotal === 0 ? 0 : (Math.min(partyBalancePage, partyBalanceTotalPages) - 1) * partyPageSize + 1;
  const partyRangeEnd = partyBalanceTotal === 0 ? 0 : Math.min(partyRangeStart + partyBalancePaginatedRows.length - 1, partyBalanceTotal);

  // Fetch Sales Report
  const {
    data: salesReportData,
    isLoading: salesLoading,
    refetch: refetchSales
  } = useGetSalesReportQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    groupBy: salesGroupBy
  }, {
    skip: activeTab !== 'sales'
  });

  // Fetch Inventory Report
  const {
    data: inventoryReportData,
    isLoading: inventoryLoading,
    refetch: refetchInventory
  } = useGetInventoryReportQuery({
    type: inventoryType,
    ...(debouncedInventoryProductSearch.trim() ? { search: debouncedInventoryProductSearch.trim() } : {}),
    ...(inventoryType === 'stock-summary' && { dateFrom: dateRange.from, dateTo: dateRange.to })
  }, {
    skip: activeTab !== 'inventory'
  });

  // Fetch Financial Report
  const {
    data: financialReportData,
    isLoading: financialLoading,
    refetch: refetchFinancial
  } = useGetFinancialReportQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    type: financialType
  }, {
    skip: activeTab !== 'financial'
  });

  // Fetch Bank & Cash Summary
  const bankCashDateParams = useMemo(() => {
    if (bankCashFilterMode === 'month' && bankCashMonth) {
      return { month: bankCashMonth };
    }
    return {
      dateFrom: bankCashDateRange.from,
      dateTo: bankCashDateRange.to
    };
  }, [bankCashFilterMode, bankCashMonth, bankCashDateRange.from, bankCashDateRange.to]);

  const {
    data: bankCashSummaryData,
    isLoading: bankCashLoading,
    refetch: refetchBankCash
  } = useGetBankCashSummaryQuery({
    ...bankCashDateParams,
    ...(selectedBankIds.length ? { bankIds: selectedBankIds.join(',') } : {})
  }, {
    skip: activeTab !== 'bank-cash'
  });

  const { data: banksData } = useGetBanksQuery({ limit: 500 }, { skip: activeTab !== 'bank-cash' });
  const availableBanks = banksData?.data?.banks || banksData?.banks || [];

  const isInventoryPaginated = INVENTORY_PAGINATED_TYPES.includes(inventoryType);

  const stockSummaryAllRows = useMemo(() => {
    if (activeTab !== 'inventory' || !isInventoryPaginated) return [];
    return inventoryReportData?.data || [];
  }, [activeTab, isInventoryPaginated, inventoryReportData?.data]);

  const stockSummaryTotal = stockSummaryAllRows.length;
  const stockSummaryTotalPages = Math.max(1, Math.ceil(stockSummaryTotal / stockSummaryPageSize) || 1);

  useEffect(() => {
    setStockSummaryPage(1);
  }, [inventoryType, dateRange.from, dateRange.to, debouncedInventoryProductSearch]);

  useEffect(() => {
    setStockSummaryPage(1);
  }, [stockSummaryPageSize]);

  useEffect(() => {
    setStockSummaryPage((p) => Math.min(p, stockSummaryTotalPages));
  }, [stockSummaryTotalPages]);

  const stockSummaryPaginatedRows = useMemo(() => {
    if (!isInventoryPaginated) return [];
    const page = Math.min(stockSummaryPage, stockSummaryTotalPages);
    const start = (page - 1) * stockSummaryPageSize;
    return stockSummaryAllRows.slice(start, start + stockSummaryPageSize);
  }, [
    stockSummaryAllRows,
    stockSummaryPage,
    stockSummaryTotalPages,
    stockSummaryPageSize,
    isInventoryPaginated
  ]);

  const stockRangeStart =
    stockSummaryTotal === 0 ? 0 : (Math.min(stockSummaryPage, stockSummaryTotalPages) - 1) * stockSummaryPageSize + 1;
  const stockRangeEnd =
    stockSummaryTotal === 0
      ? 0
      : Math.min(stockRangeStart + stockSummaryPaginatedRows.length - 1, stockSummaryTotal);

  const summary = summaryData || {};
  const handleToggleBank = (bankId) => {
    setSelectedBankIds((prev) =>
      prev.includes(bankId) ? prev.filter((id) => id !== bankId) : [...prev, bankId]
    );
  };

  // Define columns for different reports
  const getColumns = () => {
    switch (activeTab) {
      case 'party-balance':
        return [
          { header: 'S.NO', render: (row, idx) => (idx ?? 0) + 1, align: 'right', key: 'sno' },
          {
            header: 'Party Name',
            render: (row) => (
              <div>
                <div className="font-medium">{row.businessName || row.name}</div>
                {row.businessName && row.businessName !== row.contactPerson && row.contactPerson && (
                  <div className="text-xs text-gray-500">Contact: {row.contactPerson}</div>
                )}
              </div>
            )
          },
          { header: 'City', key: 'city' },
          {
            header: 'Opening Bal.',
            render: (row) => (row.openingBalance ?? 0).toLocaleString(),
            align: 'right',
          },
          {
            header: 'Ledger Dr',
            render: (row) => (row.totalDebit || 0).toLocaleString(),
            align: 'right',
          },
          {
            header: 'Ledger Cr',
            render: (row) => (row.totalCredit || 0).toLocaleString(),
            align: 'right',
          },
          {
            header: 'Net Balance',
            render: (row) => (row.balance || 0).toLocaleString(),
            align: 'right',
            bold: true,
          },
        ];
      case 'sales':
        if (salesGroupBy === 'daily') {
          return [
            { header: 'S.NO', render: (row, idx) => (idx ?? 0) + 1, align: 'right', key: 'sno' },
            { header: 'Date', render: (row) => new Date(row.date).toLocaleDateString() },
            { header: 'Orders', key: 'totalOrders', align: 'right' },
            { header: 'Subtotal', render: (row) => (row.subtotal || 0).toLocaleString(), align: 'right' },
            { header: 'Discount', render: (row) => (row.discount || 0).toLocaleString(), align: 'right' },
            { header: 'Net Total', render: (row) => (row.total || 0).toLocaleString(), align: 'right', bold: true },
          ];
        }
        if (salesGroupBy === 'monthly') {
          return [
            { header: 'S.NO', render: (row, idx) => (idx ?? 0) + 1, align: 'right', key: 'sno' },
            { header: 'Month', key: 'month' },
            { header: 'Orders', key: 'totalOrders', align: 'right' },
            { header: 'Revenue', render: (row) => (row.total || 0).toLocaleString(), align: 'right', bold: true },
          ];
        }
        if (salesGroupBy === 'product') {
          return [
            { header: 'S.NO', render: (row, idx) => (idx ?? 0) + 1, align: 'right', key: 'sno' },
            { header: 'Product', key: 'productName' },
            { header: 'SKU', key: 'sku' },
            { header: 'Qty Sold', render: (row) => (row.totalQuantity || 0).toLocaleString(), align: 'right' },
            { header: 'Revenue', render: (row) => (row.totalRevenue || 0).toLocaleString(), align: 'right', bold: true },
          ];
        }
        if (salesGroupBy === 'category') {
          return [
            { header: 'S.NO', render: (row, idx) => (idx ?? 0) + 1, align: 'right', key: 'sno' },
            { header: 'Category', key: 'categoryName' },
            { header: 'Items Sold', render: (row) => (row.itemCount || 0).toLocaleString(), align: 'right' },
            { header: 'Revenue', render: (row) => (row.totalRevenue || 0).toLocaleString(), align: 'right', bold: true },
          ];
        }
        if (salesGroupBy === 'city') {
          return [
            { header: 'S.NO', render: (row, idx) => (idx ?? 0) + 1, align: 'right', key: 'sno' },
            { header: 'City', key: 'city' },
            { header: 'Orders', key: 'totalOrders', align: 'right' },
            { header: 'Revenue', render: (row) => (row.totalRevenue || 0).toLocaleString(), align: 'right', bold: true },
          ];
        }
        if (salesGroupBy === 'invoice') {
          return [
            { header: 'S.NO', render: (row, idx) => (idx ?? 0) + 1, align: 'right', key: 'sno' },
            { header: 'Invoice #', key: 'invoiceNo' },
            { header: 'Date', render: (row) => new Date(row.date).toLocaleDateString() },
            { header: 'Customer', render: (row) => row.customerName || row.name || 'N/A' },
            { header: 'Total', render: (row) => (row.total || 0).toLocaleString(), align: 'right', bold: true },
            { header: 'Status', key: 'status' },
          ];
        }
        return [];
      case 'inventory':
        if (inventoryType === 'stock-summary') {
          return [
            { header: 'S.NO', render: (row, idx) => (idx ?? 0) + 1, align: 'right', key: 'sno' },
            { header: 'Product Name', key: 'name' },
            ...(showCostPrice ? [
              { header: 'Last Purchase Price', render: (row) => (row.lastPurchasePrice || 0).toLocaleString(), align: 'right' },
              { header: 'Op. Amount', render: (row) => (row.openingAmount || 0).toLocaleString(), align: 'right' },
              { header: 'Purchase Amt', render: (row) => (row.purchaseAmount || 0).toLocaleString(), align: 'right' },
              { header: 'Pur.Ret Amt', render: (row) => (row.purchaseReturnAmount || 0).toLocaleString(), align: 'right' },
              { header: 'Sale Amt', render: (row) => (row.saleAmount || 0).toLocaleString(), align: 'right' },
              { header: 'Sale Ret Amt', render: (row) => (row.saleReturnAmount || 0).toLocaleString(), align: 'right' },
              { header: 'Damage Amt', render: (row) => (row.damageAmount || 0).toLocaleString(), align: 'right' },
              { header: 'Closing Amt', render: (row) => (row.closingAmount || 0).toLocaleString(), align: 'right', bold: true },
            ] : []),
            { header: 'Op. Qty', render: (row) => (row.openingQty || 0).toLocaleString(), align: 'right' },
            { header: 'Purchase Qty', render: (row) => (row.purchaseQty || 0).toLocaleString(), align: 'right' },
            { header: 'Pur.Ret Qty', render: (row) => (row.purchaseReturnQty || 0).toLocaleString(), align: 'right' },
            { header: 'Sale Qty', render: (row) => (row.saleQty || 0).toLocaleString(), align: 'right' },
            { header: 'Sale Ret Qty', render: (row) => (row.saleReturnQty || 0).toLocaleString(), align: 'right' },
            { header: 'Damage Qty', render: (row) => (row.damageQty || 0).toLocaleString(), align: 'right' },
            { header: 'Closing Qty', render: (row) => (row.closingQty || 0).toLocaleString(), align: 'right', bold: true },
            { header: 'Current Stock', render: (row) => (row.currentStock || 0).toLocaleString(), align: 'right', bold: true },
            {
              header: 'Reconcile Delta',
              render: (row) => {
                const delta = Number(row.reconciliationDelta || 0);
                const cls = delta === 0 ? 'text-green-700' : delta > 0 ? 'text-red-700' : 'text-amber-700';
                return <span className={cls}>{delta.toLocaleString()}</span>;
              },
              align: 'right',
              bold: true
            },
            { header: 'Retail Val.', render: (row) => (row.retailValuation || 0).toLocaleString(), align: 'right', bold: true },
            { header: 'Sale Price1', render: (row) => (row.salePrice1 || 0).toLocaleString(), align: 'right' },
          ];
        }
        const baseCols = [
          { header: 'S.NO', render: (row, idx) => (idx ?? 0) + 1, align: 'right', key: 'sno' },
          { header: 'Product Name', key: 'name' },
          { header: 'SKU', key: 'sku' },
          { header: 'Category', key: 'categoryName' },
          { header: 'Stock', render: (row) => `${(row.stockQuantity || 0).toLocaleString()} ${row.unit || ''}`, align: 'right' },
        ];
        if (inventoryType === 'valuation') {
          return [
            ...baseCols,
            ...(showCostPrice ? [
              { header: 'Cost Price', render: (row) => (row.costPrice || 0).toLocaleString(), align: 'right' },
              { header: 'Valuation', render: (row) => (row.valuation || 0).toLocaleString(), align: 'right', bold: true },
            ] : []),
            { header: 'Retail Val.', render: (row) => (row.retailValuation || 0).toLocaleString(), align: 'right', bold: true },
          ];
        }
        // Current Stock: show only stock info (no Status column). Low Stock tab is separate.
        if (inventoryType === 'summary') {
          return [
            ...baseCols,
            { header: 'Min Level', render: (row) => (row.minStockLevel || 0).toLocaleString(), align: 'right' },
          ];
        }
        // Low Stock tab: include Status
        return [
          ...baseCols,
          { header: 'Min Level', render: (row) => (row.minStockLevel || 0).toLocaleString(), align: 'right' },
          { header: 'Status', render: (row) => row.stockQuantity <= row.minStockLevel ? <span className="text-red-600 font-bold">Low Stock</span> : <span className="text-green-600">Normal</span> },
        ];
      case 'financial':
        if (financialType === 'trial-balance') {
          return [
            { header: 'S.NO', render: (row, idx) => (idx ?? 0) + 1, align: 'right', key: 'sno' },
            { header: 'Code', key: 'accountCode' },
            { header: 'Account Name', key: 'accountName' },
            { header: 'Debit Balance', render: (row) => row.debitBalance > 0 ? row.debitBalance.toLocaleString() : '-', align: 'right' },
            { header: 'Credit Balance', render: (row) => row.creditBalance > 0 ? row.creditBalance.toLocaleString() : '-', align: 'right' },
          ];
        }
        if (financialType === 'pl-statement') {
          return [
            { header: 'S.NO', render: (row, idx) => (idx ?? 0) + 1, align: 'right', key: 'sno' },
            { header: 'Category', key: 'category' },
            { header: 'Account', key: 'accountName' },
            { header: 'Type', key: 'accountType', render: (row) => <span className="capitalize">{row.accountType}</span> },
            { header: 'Amount', render: (row) => (row.amount || 0).toLocaleString(), align: 'right', bold: true },
          ];
        }
        if (financialType === 'balance-sheet') {
          return [
            { header: 'S.NO', render: (row, idx) => (idx ?? 0) + 1, align: 'right', key: 'sno' },
            { header: 'Type', key: 'accountType', render: (row) => <span className="capitalize font-bold">{row.accountType}</span> },
            { header: 'Category', key: 'category' },
            { header: 'Account', key: 'accountName' },
            { header: 'Balance', render: (row) => (row.balance || 0).toLocaleString(), align: 'right', bold: true },
          ];
        }
        return [];
      case 'bank-cash':
        return [
          { header: 'S.NO', render: (row, idx) => (idx ?? 0) + 1, align: 'right', key: 'sno' },
          { header: 'Bank', render: (row) => row.bankName || 'N/A' },
          { header: 'Account', render: (row) => row.accountNumber || row.accountName || '-' },
          { header: 'Opening', render: (row) => (row.openingBalance || 0).toLocaleString(), align: 'right' },
          { header: 'Receipts', render: (row) => (row.totalReceipts || 0).toLocaleString(), align: 'right' },
          { header: 'Payments', render: (row) => (row.totalPayments || 0).toLocaleString(), align: 'right' },
          { header: 'Balance', render: (row) => (row.balance || 0).toLocaleString(), align: 'right', bold: true },
        ];
      default:
        return [];
    }
  };

  const virtualizePartyRows = activeTab === 'party-balance' && partyBalancePaginatedRows.length > 35;
  const virtualizeStockSummaryRows =
    activeTab === 'inventory' && isInventoryPaginated && stockSummaryPaginatedRows.length > 35;

  const { scrollRef: partyTableScrollRef, virtualizer: partyRowVirtualizer } = useTableRowVirtualizer({
    rowCount: partyBalancePaginatedRows.length,
    enabled: virtualizePartyRows,
    estimateSize: 52,
  });
  const { scrollRef: stockSummaryTableScrollRef, virtualizer: stockSummaryRowVirtualizer } = useTableRowVirtualizer({
    rowCount: stockSummaryPaginatedRows.length,
    enabled: virtualizeStockSummaryRows,
    estimateSize: 52,
  });

  const getReportTitle = () => {
    switch (activeTab) {
      case 'party-balance':
        return `${partyType === 'customer' ? 'Customer' : 'Supplier'} Balance Report`;
      case 'sales':
        return `Sales Analysis (${salesGroupBy.charAt(0).toUpperCase() + salesGroupBy.slice(1)})`;
      case 'inventory':
        return `Inventory ${inventoryType === 'stock-summary' ? 'Stock Summary' : inventoryType === 'summary' ? 'Current Stock' : inventoryType === 'low-stock' ? 'Low Stock' : 'Valuation'} Report`;
      case 'financial':
        return financialType === 'trial-balance' ? 'Trial Balance' : financialType === 'pl-statement' ? 'Profit & Loss Statement' : 'Balance Sheet';
      case 'bank-cash':
        return 'Bank & Cash Summary';
      default:
        return 'Business Report';
    }
  };

  const getReportData = () => {
    switch (activeTab) {
      case 'party-balance':
        return partyReportData?.data || [];
      case 'sales':
        return salesReportData?.data || [];
      case 'inventory':
        return inventoryReportData?.data || [];
      case 'financial':
        return financialReportData?.data || [];
      case 'bank-cash':
        return bankCashSummaryData?.banks || [];
      default:
        return [];
    }
  };

  const getSummaryData = () => {
    if (activeTab === 'party-balance') {
      return {
        [`Total ${partyType === 'customer' ? 'Customer' : 'Supplier'} Balance`]:
          partyType === 'customer' ? summary.totalCustomerBalance : summary.totalSupplierBalance
      };
    }
    if (activeTab === 'sales') {
      return {
        'Total Orders': salesReportData?.summary?.totalOrders || 0,
        'Total Revenue': salesReportData?.summary?.totalRevenue || 0,
        'Avg Order Value': salesReportData?.summary?.averageOrderValue || 0
      };
    }
    if (activeTab === 'inventory') {
      const base = {
        'Total Items': inventoryReportData?.summary?.totalItems || 0,
        'Total Cost': inventoryReportData?.summary?.totalCost || 0,
        'In Stock': inventoryReportData?.summary?.inStockCount || 0,
        'Out of Stock': inventoryReportData?.summary?.outOfStockCount || 0
      };
      if (inventoryType === 'stock-summary') {
        const valData = {
          ...base,
          'Retail Valuation': inventoryReportData?.summary?.totalRetailValuation ?? 0,
          'Reconcile Delta': inventoryReportData?.summary?.totalReconciliationDelta ?? 0
        };
        if (showCostPrice) {
          valData['Wholesale Valuation'] = inventoryReportData?.summary?.totalWholesaleValuation ?? 0;
          valData['Total Cost'] = inventoryReportData?.summary?.totalCost || 0;
        }
        return valData;
      }
      return {
        ...base,
        'Retail Valuation': inventoryReportData?.summary?.totalRetailValuation ?? 0
      };
    }
    if (activeTab === 'financial') {
      if (financialType === 'trial-balance') {
        return {
          'Total Debit': financialReportData?.summary?.totalDebit || 0,
          'Total Credit': financialReportData?.summary?.totalCredit || 0,
          'Difference': (financialReportData?.summary?.totalDebit || 0) - (financialReportData?.summary?.totalCredit || 0)
        };
      }
      if (financialType === 'pl-statement') {
        return {
          'Total Revenue': financialReportData?.summary?.totalRevenue || 0,
          'Total Expenses': financialReportData?.summary?.totalExpenses || 0,
          'Net Profit': financialReportData?.summary?.netProfit || 0
        };
      }
      if (financialType === 'balance-sheet') {
        return {
          'Total Assets': financialReportData?.summary?.totalAssets || 0,
          'Total Liabilities': financialReportData?.summary?.totalLiabilities || 0,
          'Total Equity': financialReportData?.summary?.totalEquity || 0,
          'L + E': (financialReportData?.summary?.totalLiabilities || 0) + (financialReportData?.summary?.totalEquity || 0)
        };
      }
    }
    if (activeTab === 'bank-cash') {
      return {
        'Total Bank Balance': bankCashSummaryData?.totals?.totalBankBalance || 0,
        'Cash Balance': bankCashSummaryData?.cash?.balance || 0
      };
    }
    return null;
  };

  const getSummaryTrend = (title) => {
    if (activeTab === 'party-balance') return 'Current Total';
    if (activeTab === 'sales') return 'In Selected Period';
    if (activeTab === 'inventory') {
      if (title === 'Total Cost') return 'Cost Price';
      if (title === 'Wholesale Valuation') return 'Wholesale Price';
      if (title === 'Retail Valuation') return 'Retail Price';
      return 'Current Status';
    }
    if (activeTab === 'bank-cash') return 'Current Total';
    return '';
  };

  const getExportData = () => {
    const reportTitle = getReportTitle();
    const data = getReportData();
    let columns = [];

    // Map UI columns to ExcelJS columns
    switch (activeTab) {
      case 'party-balance':
        columns = [
          { header: 'S.NO', key: 'sno', width: 8, type: 'number' },
          { header: 'Party Name', key: 'businessName', width: 35 },
          { header: 'City', key: 'city', width: 15 },
          { header: 'Opening Bal.', key: 'openingBalance', width: 15, type: 'currency' },
          { header: 'Ledger Dr', key: 'totalDebit', width: 15, type: 'currency' },
          { header: 'Ledger Cr', key: 'totalCredit', width: 15, type: 'currency' },
          { header: 'Net Balance', key: 'balance', width: 20, type: 'currency' }
        ];
        break;
      case 'sales':
        if (salesGroupBy === 'daily') {
          columns = [
            { header: 'S.NO', key: 'sno', width: 8, type: 'number' },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Orders', key: 'totalOrders', width: 10, type: 'number' },
            { header: 'Subtotal', key: 'subtotal', width: 15, type: 'currency' },
            { header: 'Discount', key: 'discount', width: 15, type: 'currency' },
            { header: 'Net Total', key: 'total', width: 15, type: 'currency' }
          ];
        } else if (salesGroupBy === 'product') {
          columns = [
            { header: 'S.NO', key: 'sno', width: 8, type: 'number' },
            { header: 'Image', key: 'imageUrl', width: 12, type: 'image' },
            { header: 'Product', key: 'productName', width: 40 },
            { header: 'SKU', key: 'sku', width: 15 },
            { header: 'Qty Sold', key: 'totalQuantity', width: 12, type: 'number' },
            { header: 'Revenue', key: 'totalRevenue', width: 15, type: 'currency' }
          ];
        } else {
          columns = [
            { header: 'S.NO', key: 'sno', width: 8, type: 'number' },
            { header: 'Group', key: salesGroupBy === 'monthly' ? 'month' : salesGroupBy === 'category' ? 'categoryName' : 'name', width: 25 },
            { header: 'Orders/Items', key: 'totalOrders', width: 15, type: 'number' },
            { header: 'Revenue', key: 'totalRevenue', width: 20, type: 'currency' }
          ];
        }
        break;
      case 'inventory':
        if (inventoryType === 'stock-summary') {
          columns = [
            { header: 'S.NO', key: 'sno', width: 8, type: 'number' },
            { header: 'Image', key: 'imageUrl', width: 12, type: 'image' },
            { header: 'Product Name', key: 'name', width: 40 },
            { header: 'SKU', key: 'sku', width: 15 },
            { header: 'Category', key: 'categoryName', width: 20 },
            { header: 'Op. Qty', key: 'openingQty', width: 12, type: 'number' },
            { header: 'Purchase Qty', key: 'purchaseQty', width: 12, type: 'number' },
            { header: 'Sale Qty', key: 'saleQty', width: 12, type: 'number' },
            { header: 'Sale Amt', key: 'saleAmount', width: 15, type: 'currency' },
            { header: 'Current Stock', key: 'currentStock', width: 15, type: 'number' },
            ...(showCostPrice ? [
              { header: 'Op. Amount', key: 'openingAmount', width: 15, type: 'currency' },
              { header: 'Purchase Amt', key: 'purchaseAmount', width: 15, type: 'currency' },
              { header: 'Last Pur. Price', key: 'lastPurchasePrice', width: 15, type: 'currency' },
              { header: 'Closing Amt', key: 'closingAmount', width: 15, type: 'currency' }
            ] : [])
          ];
        } else {
          columns = [
            { header: 'S.NO', key: 'sno', width: 8, type: 'number' },
            { header: 'Image', key: 'imageUrl', width: 12, type: 'image' },
            { header: 'Product Name', key: 'name', width: 40 },
            { header: 'SKU', key: 'sku', width: 15 },
            { header: 'Category', key: 'categoryName', width: 20 },
            { header: 'Stock', key: 'stockQuantity', width: 12, type: 'number' },
            { header: 'Cost Price', key: 'costPrice', width: 15, type: 'currency' },
            { header: 'Valuation', key: 'valuation', width: 15, type: 'currency' }
          ];
        }
        break;
      case 'financial':
        if (financialType === 'trial-balance') {
          columns = [
            { header: 'S.NO', key: 'sno', width: 8, type: 'number' },
            { header: 'Account Name', key: 'accountName', width: 35 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Debit', key: 'debitBalance', width: 20, type: 'currency' },
            { header: 'Credit', key: 'creditBalance', width: 20, type: 'currency' }
          ];
        } else {
          columns = [
            { header: 'S.NO', key: 'sno', width: 8, type: 'number' },
            { header: 'Account Name', key: 'accountName', width: 35 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Amount/Balance', key: 'amount', width: 20, type: 'currency' }
          ];
          if (financialType === 'balance-sheet') {
            columns[3].key = 'balance';
          }
        }
        break;
      case 'bank-cash':
        columns = [
          { header: 'S.NO', key: 'sno', width: 8, type: 'number' },
          { header: 'Bank Name', key: 'bankName', width: 30 },
          { header: 'Account', key: 'accountNumber', width: 25 },
          { header: 'Opening', key: 'openingBalance', width: 15, type: 'currency' },
          { header: 'Receipts', key: 'totalReceipts', width: 15, type: 'currency' },
          { header: 'Payments', key: 'totalPayments', width: 15, type: 'currency' },
          { header: 'Balance', key: 'balance', width: 20, type: 'currency' }
        ];
        break;
    }

    return {
      title: reportTitle,
      filename: `${reportTitle.replace(/ /g, '_')}_${new Date().toLocaleDateString()}.xlsx`,
      columns,
      data: data.map((item, i) => ({
        ...item,
        sno: i + 1,
        name: item.businessName || item.name || item.accountName || item.productName || item.bankName
      })),
      summary: (() => {
        if (activeTab === 'inventory' && inventoryType === 'stock-summary') {
          return {
            rows: [
              {
                label: 'GRAND TOTAL:',
                name: `${data.length} Items`,
                openingQty: inventoryReportData?.summary?.totalOpeningQty || 0,
                openingAmount: inventoryReportData?.summary?.totalOpeningAmount || 0,
                purchaseQty: inventoryReportData?.summary?.totalPurchaseQty || 0,
                purchaseAmount: inventoryReportData?.summary?.totalPurchaseAmount || 0,
                purchaseReturnQty: inventoryReportData?.summary?.totalPurchaseReturnQty || 0,
                purchaseReturnAmount: inventoryReportData?.summary?.totalPurchaseReturnAmount || 0,
                saleQty: inventoryReportData?.summary?.totalSaleQty || 0,
                saleAmount: inventoryReportData?.summary?.totalSaleAmount || 0,
                saleReturnQty: inventoryReportData?.summary?.totalSaleReturnQty || 0,
                saleReturnAmount: inventoryReportData?.summary?.totalSaleReturnAmount || 0,
                damageQty: inventoryReportData?.summary?.totalDamageQty || 0,
                damageAmount: inventoryReportData?.summary?.totalDamageAmount || 0,
                closingQty: inventoryReportData?.summary?.totalClosingQty || 0,
                closingAmount: inventoryReportData?.summary?.totalCost || 0,
                currentStock: inventoryReportData?.summary?.totalCurrentStock || 0
              }
            ]
          };
        }
        if (activeTab === 'party-balance') {
          return {
            rows: [
              {
                label: 'GRAND TOTAL:',
                openingBalance: partyReportData?.summary?.totalOpeningBalance || 0,
                totalDebit: partyReportData?.summary?.totalDebit || 0,
                totalCredit: partyReportData?.summary?.totalCredit || 0,
                balance: (partyType === 'customer' ? partyReportData?.totalCustomerBalance : partyReportData?.totalSupplierBalance) || 0
              }
            ]
          };
        }
        return null;
      })()
    };
  };

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header & Global Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporting Dashboard</h1>
          <p className="text-gray-500 text-sm">Real-time business analytics & financial reports</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(activeTab !== 'bank-cash') && (activeTab !== 'inventory' || inventoryType === 'stock-summary') && (
            <DateFilter
              startDate={dateRange.from}
              endDate={dateRange.to}
              onDateChange={(start, end) => {
                setDateRange({ from: start || '', to: end || '' });
              }}
              compact={true}
              showPresets={true}
            />
          )}

          <button
            onClick={handleRefresh}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCcw className={`h-5 w-5 ${(summaryLoading || partyLoading || salesLoading || inventoryLoading || financialLoading || bankCashLoading) ? 'animate-spin' : ''}`} />
          </button>

          <ExcelExportButton
            getData={getExportData}
            label="Export Report"
            className="border-indigo-200 bg-white text-indigo-700 hover:border-indigo-500 hover:bg-indigo-50 transition-all font-semibold"
          />
          <PdfExportButton
            getData={getExportData}
            label="PDF Report"
            className="border-indigo-200 bg-white text-indigo-700 hover:border-indigo-500 hover:bg-indigo-50 transition-all font-semibold"
          />
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-blue-200 bg-white text-blue-700 hover:border-blue-500 hover:bg-blue-50 transition-all font-semibold rounded-lg text-sm h-9"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${activeTab === 'inventory' ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-4'}`}>
        {Object.entries(getSummaryData() || {}).map(([title, value], idx) => {
          const getIcon = () => {
            if (title === 'Wholesale Valuation') return <DollarSign className="h-6 w-6 text-amber-600" />;
            if (title === 'Retail Valuation') return <ShoppingBag className="h-6 w-6 text-teal-600" />;
            if (title === 'In Stock') return <CheckCircle className="h-6 w-6 text-green-600" />;
            if (title === 'Out of Stock') return <XCircle className="h-6 w-6 text-red-600" />;
            return idx === 0 ? <Users className="h-6 w-6 text-blue-600" /> :
              idx === 1 ? <TrendingUp className="h-6 w-6 text-purple-600" /> :
                <Package className="h-6 w-6 text-gray-600" />;
          };
          const getBgColor = () => {
            if (title === 'Wholesale Valuation') return "bg-amber-50";
            if (title === 'Retail Valuation') return "bg-teal-50";
            if (title === 'In Stock') return "bg-green-50";
            if (title === 'Out of Stock') return "bg-red-50";
            return idx === 0 ? "bg-blue-50" :
              idx === 1 ? "bg-purple-50" :
                "bg-gray-50";
          };
          return (
            <SummaryCard
              key={title}
              title={title}
              value={value}
              icon={getIcon()}
              bgColor={getBgColor()}
              trend={getSummaryTrend(title)}
            />
          );
        })}
      </div>

      {/* Main Report Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-gray-100">
          <nav className="flex overflow-x-auto">
            <TabButton
              active={activeTab === 'party-balance'}
              onClick={() => setActiveTab('party-balance')}
              label="Party Balances"
            />
            <TabButton
              active={activeTab === 'sales'}
              onClick={() => setActiveTab('sales')}
              label="Sales Analysis"
            />
            <TabButton
              active={activeTab === 'inventory'}
              onClick={() => setActiveTab('inventory')}
              label="Inventory"
            />
            <TabButton
              active={activeTab === 'financial'}
              onClick={() => setActiveTab('financial')}
              label="Financials"
            />
            <TabButton
              active={activeTab === 'bank-cash'}
              onClick={() => setActiveTab('bank-cash')}
              label="Bank & Cash"
            />
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'party-balance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setPartyType('customer')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${partyType === 'customer' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    Customers
                  </button>
                  <button
                    onClick={() => setPartyType('supplier')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${partyType === 'supplier' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    Suppliers
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <span>
                    {partyBalanceTotal} {partyType === 'customer' ? 'customers' : 'suppliers'} total
                  </span>
                  <span className="text-gray-400">·</span>
                  <span>
                    Rows {partyRangeStart}–{partyRangeEnd} of {partyBalanceTotal}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Net balance = opening balance + ledger activity on AR (1100) or AP (2000). Ledger Dr/Cr exclude
                opening-balance postings so they match the general ledger.
              </p>

              <div
                ref={partyTableScrollRef}
                className={`overflow-x-auto border border-gray-100 rounded-lg ${virtualizePartyRows ? 'max-h-[min(70vh,560px)] overflow-y-auto' : ''}`}
              >
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {getColumns().map((col, idx) => (
                        <th key={idx} className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {partyLoading ? (
                      <tr>
                        <td colSpan={getColumns().length} className="px-6 py-10 text-center">
                          <div className="flex justify-center"><RefreshCcw className="h-6 w-6 animate-spin text-gray-400" /></div>
                        </td>
                      </tr>
                    ) : partyBalanceTotal === 0 ? (
                      <tr>
                        <td colSpan={getColumns().length} className="px-6 py-10 text-center text-gray-500">No data found for the selected filters</td>
                      </tr>
                    ) : !virtualizePartyRows ? (
                      partyBalancePaginatedRows.map((row, idx) => {
                        const rowIndex = (Math.min(partyBalancePage, partyBalanceTotalPages) - 1) * partyPageSize + idx;
                        return (
                          <tr key={row.id || idx} className="hover:bg-gray-50 transition-colors">
                            {getColumns().map((col, colIdx) => (
                              <td key={colIdx} className={`px-6 py-4 whitespace-nowrap text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.bold ? 'font-bold' : ''}`}>
                                {col.render ? col.render(row, rowIndex) : row[col.key]}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    ) : (
                      (() => {
                        const cols = getColumns();
                        const colSpan = cols.length;
                        const vItems = partyRowVirtualizer.getVirtualItems();
                        const totalH = partyRowVirtualizer.getTotalSize();
                        const { padTop, padBottom } = getVirtualTablePadding(vItems, totalH);
                        const pageBase = (Math.min(partyBalancePage, partyBalanceTotalPages) - 1) * partyPageSize;
                        return (
                          <>
                            {padTop > 0 ? (
                              <tr aria-hidden className="pointer-events-none">
                                <td colSpan={colSpan} className="p-0 border-0" style={{ height: padTop }} />
                              </tr>
                            ) : null}
                            {vItems.map((vr) => {
                              const row = partyBalancePaginatedRows[vr.index];
                              const rowIndex = pageBase + vr.index;
                              return (
                                <tr key={vr.key} className="hover:bg-gray-50 transition-colors" style={{ height: vr.size }}>
                                  {cols.map((col, colIdx) => (
                                    <td key={colIdx} className={`px-6 py-4 whitespace-nowrap text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.bold ? 'font-bold' : ''}`}>
                                      {col.render ? col.render(row, rowIndex) : row[col.key]}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                            {padBottom > 0 ? (
                              <tr aria-hidden className="pointer-events-none">
                                <td colSpan={colSpan} className="p-0 border-0" style={{ height: padBottom }} />
                              </tr>
                            ) : null}
                          </>
                        );
                      })()
                    )}
                  </tbody>
                </table>
              </div>

              {partyBalanceTotal > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <label htmlFor="party-page-size" className="text-sm text-gray-600 whitespace-nowrap">
                      Rows per page
                    </label>
                    <select
                      id="party-page-size"
                      value={partyPageSize}
                      onChange={(e) => setPartyPageSize(Number(e.target.value))}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      {PARTY_PAGE_SIZES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setPartyBalancePage((p) => Math.max(1, p - 1))}
                      disabled={partyBalancePage <= 1}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 tabular-nums px-2">
                      Page {Math.min(partyBalancePage, partyBalanceTotalPages)} of {partyBalanceTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPartyBalancePage((p) => Math.min(partyBalanceTotalPages, p + 1))}
                      disabled={partyBalancePage >= partyBalanceTotalPages}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
                  {[
                    { id: 'daily', label: 'Daily' },
                    { id: 'monthly', label: 'Monthly' },
                    { id: 'product', label: 'Product-wise' },
                    { id: 'category', label: 'Category-wise' },
                    { id: 'city', label: 'City-wise' },
                    { id: 'invoice', label: 'Invoices' }
                  ].map((group) => (
                    <button
                      key={group.id}
                      onClick={() => setSalesGroupBy(group.id)}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all ${salesGroupBy === group.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
                <div className="text-sm text-gray-500">
                  {salesReportData?.data?.length || 0} Records Found
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {getColumns().map((col, idx) => (
                        <th key={idx} className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salesLoading ? (
                      <tr>
                        <td colSpan={getColumns().length} className="px-6 py-10 text-center">
                          <div className="flex justify-center"><RefreshCcw className="h-6 w-6 animate-spin text-gray-400" /></div>
                        </td>
                      </tr>
                    ) : salesReportData?.data?.length === 0 ? (
                      <tr>
                        <td colSpan={getColumns().length} className="px-6 py-10 text-center text-gray-500">No sales data found for the selected period</td>
                      </tr>
                    ) : (
                      salesReportData?.data?.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          {getColumns().map((col, colIdx) => (
                            <td key={colIdx} className={`px-6 py-4 whitespace-nowrap text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.bold ? 'font-bold' : ''}`}>
                              {col.render ? col.render(row) : row[col.key]}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  {[
                    { id: 'stock-summary', label: 'Stock Summary' },
                    { id: 'summary', label: 'Current Stock' },
                    { id: 'low-stock', label: 'Low Stock' },
                    { id: 'valuation', label: 'Stock Valuation' }
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setInventoryType(type.id)}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${inventoryType === type.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {inventoryType === 'stock-summary' && (
                    <DateFilter
                      startDate={dateRange.from}
                      endDate={dateRange.to}
                      onDateChange={(start, end) => setDateRange({ from: start || '', to: end || '' })}
                      compact={true}
                      showPresets={true}
                    />
                  )}
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <Search className="h-4 w-4 text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={inventoryProductSearch}
                      onChange={(e) => setInventoryProductSearch(e.target.value)}
                      placeholder="Search product by name or SKU..."
                      className="input w-full text-sm h-9"
                    />
                  </div>
                  <div className="text-sm text-gray-500">
                    {isInventoryPaginated ? (
                      <span>
                        {stockSummaryTotal} items
                        {stockSummaryTotal > 0 ? (
                          <span className="text-gray-400"> · Rows {stockRangeStart}–{stockRangeEnd} of {stockSummaryTotal}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span>{inventoryReportData?.data?.length || 0} Items Found</span>
                    )}
                  </div>
                </div>
              </div>

              <div
                ref={stockSummaryTableScrollRef}
                className={`overflow-x-auto border border-gray-100 rounded-lg ${virtualizeStockSummaryRows ? 'max-h-[min(70vh,560px)] overflow-y-auto' : ''}`}
              >
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {getColumns().map((col, idx) => (
                        <th key={idx} className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventoryLoading ? (
                      <tr>
                        <td colSpan={getColumns().length} className="px-6 py-10 text-center">
                          <div className="flex justify-center"><RefreshCcw className="h-6 w-6 animate-spin text-gray-400" /></div>
                        </td>
                      </tr>
                    ) : (isInventoryPaginated
                      ? stockSummaryTotal === 0
                      : (inventoryReportData?.data?.length || 0) === 0) ? (
                      <tr>
                        <td colSpan={getColumns().length} className="px-6 py-10 text-center text-gray-500">No inventory data found</td>
                      </tr>
                    ) : (
                      <>
                        {!isInventoryPaginated ? (
                          (inventoryReportData?.data || []).map((row, idx) => (
                            <tr key={row.id || idx} className="hover:bg-gray-50 transition-colors">
                              {getColumns().map((col, colIdx) => (
                                <td key={colIdx} className={`px-6 py-4 whitespace-nowrap text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.bold ? 'font-bold' : ''}`}>
                                  {col.render ? col.render(row, idx) : row[col.key]}
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : !virtualizeStockSummaryRows ? (
                          stockSummaryPaginatedRows.map((row, idx) => (
                            <tr key={row.id || idx} className="hover:bg-gray-50 transition-colors">
                              {getColumns().map((col, colIdx) => (
                                <td key={colIdx} className={`px-6 py-4 whitespace-nowrap text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.bold ? 'font-bold' : ''}`}>
                                  {col.render
                                    ? col.render(
                                      row,
                                      (Math.min(stockSummaryPage, stockSummaryTotalPages) - 1) * stockSummaryPageSize + idx
                                    )
                                    : row[col.key]}
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : (
                          (() => {
                            const cols = getColumns();
                            const colSpan = cols.length;
                            const vItems = stockSummaryRowVirtualizer.getVirtualItems();
                            const totalH = stockSummaryRowVirtualizer.getTotalSize();
                            const { padTop, padBottom } = getVirtualTablePadding(vItems, totalH);
                            const pageBase = (Math.min(stockSummaryPage, stockSummaryTotalPages) - 1) * stockSummaryPageSize;
                            return (
                              <>
                                {padTop > 0 ? (
                                  <tr aria-hidden className="pointer-events-none">
                                    <td colSpan={colSpan} className="p-0 border-0" style={{ height: padTop }} />
                                  </tr>
                                ) : null}
                                {vItems.map((vr) => {
                                  const row = stockSummaryPaginatedRows[vr.index];
                                  const rowIndex = pageBase + vr.index;
                                  return (
                                    <tr key={vr.key} className="hover:bg-gray-50 transition-colors" style={{ height: vr.size }}>
                                      {cols.map((col, colIdx) => (
                                        <td key={colIdx} className={`px-6 py-4 whitespace-nowrap text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.bold ? 'font-bold' : ''}`}>
                                          {col.render ? col.render(row, rowIndex) : row[col.key]}
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                                {padBottom > 0 ? (
                                  <tr aria-hidden className="pointer-events-none">
                                    <td colSpan={colSpan} className="p-0 border-0" style={{ height: padBottom }} />
                                  </tr>
                                ) : null}
                              </>
                            );
                          })()
                        )}
                        {inventoryType === 'stock-summary' && stockSummaryTotal > 0 && inventoryReportData?.summary && (
                          <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                            <td colSpan={3} className="px-6 py-3 text-sm text-gray-900">Grand Total</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.openingQty || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.openingAmount || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.purchaseQty || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.purchaseAmount || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.purchaseReturnQty || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.purchaseReturnAmount || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.saleQty || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.saleAmount || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.saleReturnQty || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.saleReturnAmount || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.damageQty || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.damageAmount || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.closingQty || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.totalCurrentStock || 0).toLocaleString()}</td>
                            <td className={`px-6 py-3 text-sm text-right ${Number(inventoryReportData.summary.totalReconciliationDelta || 0) === 0
                                ? 'text-green-700'
                                : Number(inventoryReportData.summary.totalReconciliationDelta || 0) > 0
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                              }`}>
                              {(inventoryReportData.summary.totalReconciliationDelta || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.closingAmount || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">{(inventoryReportData.summary.totalRetailValuation || 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-sm text-right">—</td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {isInventoryPaginated && stockSummaryTotal > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <label htmlFor="stock-summary-page-size" className="text-sm text-gray-600 whitespace-nowrap">
                      Rows per page
                    </label>
                    <select
                      id="stock-summary-page-size"
                      value={stockSummaryPageSize}
                      onChange={(e) => setStockSummaryPageSize(Number(e.target.value))}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      {STOCK_SUMMARY_PAGE_SIZES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setStockSummaryPage((p) => Math.max(1, p - 1))}
                      disabled={stockSummaryPage <= 1}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 tabular-nums px-2">
                      Page {Math.min(stockSummaryPage, stockSummaryTotalPages)} of {stockSummaryTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStockSummaryPage((p) => Math.min(stockSummaryTotalPages, p + 1))}
                      disabled={stockSummaryPage >= stockSummaryTotalPages}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'financial' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  {[
                    { id: 'trial-balance', label: 'Trial Balance' },
                    { id: 'pl-statement', label: 'Profit & Loss' },
                    { id: 'balance-sheet', label: 'Balance Sheet' }
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setFinancialType(type.id)}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${financialType === type.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                <div className="text-sm text-gray-500">
                  {financialReportData?.data?.length || 0} Accounts Found
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {getColumns().map((col, idx) => (
                        <th key={idx} className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {financialLoading ? (
                      <tr>
                        <td colSpan={getColumns().length} className="px-6 py-10 text-center">
                          <div className="flex justify-center"><RefreshCcw className="h-6 w-6 animate-spin text-gray-400" /></div>
                        </td>
                      </tr>
                    ) : financialReportData?.data?.length === 0 ? (
                      <tr>
                        <td colSpan={getColumns().length} className="px-6 py-10 text-center text-gray-500">No financial data found for the selected period</td>
                      </tr>
                    ) : (
                      <>
                        {financialReportData?.data?.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            {getColumns().map((col, colIdx) => (
                              <td key={colIdx} className={`px-6 py-4 whitespace-nowrap text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.bold ? 'font-bold' : ''}`}>
                                {col.render ? col.render(row) : row[col.key]}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {financialReportData?.summary && (
                          <>
                            {financialType === 'trial-balance' && (
                              <tr className="bg-gray-900 border-t-2 border-gray-800">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white uppercase">Grand Total</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white text-right"></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-400 text-right">
                                  {(financialReportData.summary.totalDebit || 0).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-400 text-right">
                                  {(financialReportData.summary.totalCredit || 0).toLocaleString()}
                                </td>
                              </tr>
                            )}
                            {financialType === 'pl-statement' && (
                              <tr className="bg-gray-900 border-t-2 border-gray-800">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white uppercase">Net Profit / Loss</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white text-right"></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-400 text-right">
                                  {(financialReportData.summary.netProfit || 0).toLocaleString()}
                                </td>
                              </tr>
                            )}
                            {financialType === 'balance-sheet' && (
                              <>
                                <tr className="bg-gray-900 border-t-2 border-gray-800">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white uppercase">Total Assets</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white text-right"></td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-400 text-right">
                                    {(financialReportData.summary.totalAssets || 0).toLocaleString()}
                                  </td>
                                </tr>
                                <tr className="bg-gray-900 border-t border-gray-800">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white uppercase">Total Liabilities + Equity</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white text-right"></td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-green-400 text-right">
                                    {((financialReportData.summary.totalLiabilities || 0) + (financialReportData.summary.totalEquity || 0)).toLocaleString()}
                                  </td>
                                </tr>
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'bank-cash' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center flex-wrap gap-3">
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                      onClick={() => setBankCashFilterMode('month')}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${bankCashFilterMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Month
                    </button>
                    <button
                      onClick={() => setBankCashFilterMode('custom')}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${bankCashFilterMode === 'custom' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Custom Range
                    </button>
                  </div>
                  {bankCashFilterMode === 'month' ? (
                    <input
                      type="month"
                      value={bankCashMonth}
                      onChange={(e) => setBankCashMonth(e.target.value)}
                      className="input h-9 text-sm"
                    />
                  ) : (
                    <DateFilter
                      startDate={bankCashDateRange.from}
                      endDate={bankCashDateRange.to}
                      onDateChange={(start, end) => setBankCashDateRange({ from: start || '', to: end || '' })}
                      compact={true}
                      showPresets={true}
                    />
                  )}
                  <div className="min-w-[260px] rounded-md border border-gray-300 bg-white p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Banks</span>
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedBankIds(availableBanks.map((bank) => bank.id || bank._id).filter(Boolean))}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedBankIds([])}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {availableBanks.map((bank) => {
                        const bankId = bank.id || bank._id;
                        if (!bankId) return null;
                        return (
                          <label key={bankId} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedBankIds.includes(bankId)}
                              onChange={() => handleToggleBank(bankId)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>
                              {bank.bankName || bank.bank_name || 'Bank'} - {bank.accountNumber || bank.account_number || bank.accountName || bank.account_name || 'Account'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {(bankCashSummaryData?.banks?.length || 0)} Banks Found
                  {selectedBankIds.length > 0 ? ` · ${selectedBankIds.length} selected` : ' · All banks'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Wallet className="h-4 w-4 text-green-600" />
                    Cash Summary
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500">Opening</div>
                      <div className="font-semibold">{(bankCashSummaryData?.cash?.openingBalance || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Balance</div>
                      <div className="font-semibold">{(bankCashSummaryData?.cash?.balance || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Receipts</div>
                      <div className="font-semibold text-green-700">{(bankCashSummaryData?.cash?.totalReceipts || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Payments</div>
                      <div className="font-semibold text-red-700">{(bankCashSummaryData?.cash?.totalPayments || 0).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    Bank Totals
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500">Opening</div>
                      <div className="font-semibold">{(bankCashSummaryData?.totals?.totalBankOpening || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Balance</div>
                      <div className="font-semibold">{(bankCashSummaryData?.totals?.totalBankBalance || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Receipts</div>
                      <div className="font-semibold text-green-700">{(bankCashSummaryData?.totals?.totalBankReceipts || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Payments</div>
                      <div className="font-semibold text-red-700">{(bankCashSummaryData?.totals?.totalBankPayments || 0).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-100 bg-green-50 p-4">
                <div className="text-sm text-gray-600">Receipts Report</div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-gray-500">Bank Receipts</div>
                    <div className="font-semibold text-green-700">{(bankCashSummaryData?.receiptSummary?.totalBankReceipts || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Cash Receipts</div>
                    <div className="font-semibold text-green-700">{(bankCashSummaryData?.receiptSummary?.totalCashReceipts || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Total Receipts</div>
                    <div className="font-semibold text-green-800">{(bankCashSummaryData?.receiptSummary?.totalReceipts || 0).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {getColumns().map((col, idx) => (
                        <th key={idx} className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bankCashLoading ? (
                      <tr>
                        <td colSpan={getColumns().length} className="px-6 py-10 text-center">
                          <div className="flex justify-center"><RefreshCcw className="h-6 w-6 animate-spin text-gray-400" /></div>
                        </td>
                      </tr>
                    ) : bankCashSummaryData?.banks?.length === 0 ? (
                      <tr>
                        <td colSpan={getColumns().length} className="px-6 py-10 text-center text-gray-500">No bank data found for the selected period</td>
                      </tr>
                    ) : (
                      bankCashSummaryData?.banks?.map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-gray-50 transition-colors">
                          {getColumns().map((col, colIdx) => (
                            <td key={colIdx} className={`px-6 py-4 whitespace-nowrap text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.bold ? 'font-bold' : ''}`}>
                              {col.render ? col.render(row) : row[col.key]}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print Modal */}
      <PrintReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        reportTitle={getReportTitle()}
        data={getReportData()}
        columns={getColumns()}
        filters={{
          dateFrom: dateRange.from,
          dateTo: dateRange.to
        }}
        summaryData={getSummaryData()}
      />
    </div>
  );
};

const SummaryCard = ({ title, value, icon, bgColor, trend }) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 font-mono">
        {typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 2 }) : (value || '0.00')}
      </h3>
      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
        {trend}
      </p>
    </div>
    <div className={`p-3 rounded-xl ${bgColor}`}>
      {icon}
    </div>
  </div>
);

const TabButton = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    className={`px-6 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${active
        ? 'border-blue-600 text-blue-600 bg-blue-50/30'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
  >
    {label}
  </button>
);
