import React, { useState, useEffect, useMemo } from 'react';
import BaseModal from '../BaseModal';
import { Button } from '@/components/ui/button';
import { useGetCOGSProfitReportQuery } from '../../store/services/reportsApi';
import { useGetCustomersQuery } from '../../store/services/customersApi';
import { LoadingSpinner, LoadingInline } from '../LoadingSpinner';
import DateFilter from '../DateFilter';
import ExcelExportButton from '../ExcelExportButton';
import PdfExportButton from '../PdfExportButton';
import PrintReportModal from '../PrintReportModal';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Receipt,
  Printer,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';

/**
 * COGSProfitReportModal - Analysis Report modal for Sales Invoices COGS & Profitability.
 *
 * Props:
 *   - isOpen: boolean
 *   - onClose: () => void
 *   - initialTab: 'cogs' | 'profit'
 *   - initialFilters: { dateFrom, dateTo, search, customerId } (optional)
 */
export default function COGSProfitReportModal({
  isOpen,
  onClose,
  initialTab = 'cogs',
  initialFilters = {},
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom || '');
  const [dateTo, setDateTo] = useState(initialFilters.dateTo || '');
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '');
  const [customerId, setCustomerId] = useState(initialFilters.customerId || '');
  
  // Local state for printer modal
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // Sync activeTab when initialTab changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Sync dates and filters if they change on parent
  useEffect(() => {
    if (initialFilters.dateFrom) setDateFrom(initialFilters.dateFrom);
    if (initialFilters.dateTo) setDateTo(initialFilters.dateTo);
    if (initialFilters.search) setSearchTerm(initialFilters.search);
    if (initialFilters.customerId) setCustomerId(initialFilters.customerId);
  }, [initialFilters]);

  // Fetch customers for filter dropdown
  const { data: customersResponse } = useGetCustomersQuery({ limit: 1000 });
  const customers = useMemo(() => {
    return customersResponse?.data?.customers || customersResponse?.customers || [];
  }, [customersResponse]);

  // Build query params
  const queryParams = useMemo(() => {
    const params = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (searchTerm) params.search = searchTerm;
    if (customerId) params.customerId = customerId;
    return params;
  }, [dateFrom, dateTo, searchTerm, customerId]);

  // Fetch the report data
  const {
    data: reportResponse,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetCOGSProfitReportQuery(queryParams, {
    skip: !isOpen,
    refetchOnMountOrArgChange: true,
  });

  const reportData = reportResponse?.data || [];
  const summary = reportResponse?.summary || {
    totalSalesRevenue: 0,
    totalCOGS: 0,
    totalGrossProfit: 0,
    overallProfitMargin: 0,
    totalInvoices: 0,
    averageCOGS: 0,
  };

  const formattedData = useMemo(() => {
    return reportData.map((item) => ({
      ...item,
      formattedDate: item.invoiceDate ? new Date(item.invoiceDate).toLocaleDateString() : '—',
      totalSaleAmountRound: Math.round(item.totalSaleAmount),
      totalProductCostRound: Math.round(item.totalProductCost),
      cogsAmountRound: Math.round(item.cogsAmount),
      grossProfitRound: Math.round(item.grossProfit),
    }));
  }, [reportData]);

  // Prepare Excel/PDF payload
  const getExportData = () => {
    const title = activeTab === 'cogs' ? 'Cost of Goods Sold (COGS) Analysis' : 'Gross Profit Analysis';
    const filename = activeTab === 'cogs'
      ? `COGS_Report_${new Date().toLocaleDateString()}.xlsx`
      : `Profit_Report_${new Date().toLocaleDateString()}.xlsx`;

    const columns = activeTab === 'cogs'
      ? [
          { header: 'Invoice #', key: 'invoiceNumber', width: 20 },
          { header: 'Date', key: 'formattedDate', width: 15 },
          { header: 'Customer', key: 'customerName', width: 30 },
          { header: 'Sale Amount', key: 'totalSaleAmountRound', width: 20, type: 'currency' },
          { header: 'Product Cost (FIFO)', key: 'totalProductCostRound', width: 20, type: 'currency' },
          { header: 'COGS Amount', key: 'cogsAmountRound', width: 20, type: 'currency' },
        ]
      : [
          { header: 'Invoice #', key: 'invoiceNumber', width: 20 },
          { header: 'Date', key: 'formattedDate', width: 15 },
          { header: 'Customer', key: 'customerName', width: 30 },
          { header: 'Sale Amount', key: 'totalSaleAmountRound', width: 20, type: 'currency' },
          { header: 'COGS Amount', key: 'cogsAmountRound', width: 20, type: 'currency' },
          { header: 'Gross Profit', key: 'grossProfitRound', width: 20, type: 'currency' },
          { header: 'Margin %', key: 'profitMarginFormatted', width: 15 },
        ];

    const data = formattedData.map((item) => ({
      ...item,
      profitMarginFormatted: `${item.profitMargin.toFixed(2)}%`,
    }));

    return {
      title,
      filename,
      columns,
      data,
    };
  };

  // Prepare printable columns
  const printableColumns = useMemo(() => {
    if (activeTab === 'cogs') {
      return [
        { header: 'Invoice #', key: 'invoiceNumber' },
        { header: 'Date', key: 'invoiceDate', render: (row) => row.formattedDate },
        { header: 'Customer', key: 'customerName' },
        { header: 'Sale Amount', key: 'totalSaleAmountRound', align: 'right', render: (row) => row.totalSaleAmountRound.toLocaleString() },
        { header: 'Product Cost (FIFO)', key: 'totalProductCostRound', align: 'right', render: (row) => row.totalProductCostRound.toLocaleString() },
        { header: 'COGS Amount', key: 'cogsAmountRound', align: 'right', render: (row) => row.cogsAmountRound.toLocaleString() },
      ];
    } else {
      return [
        { header: 'Invoice #', key: 'invoiceNumber' },
        { header: 'Date', key: 'invoiceDate', render: (row) => row.formattedDate },
        { header: 'Customer', key: 'customerName' },
        { header: 'Sale Amount', key: 'totalSaleAmountRound', align: 'right', render: (row) => row.totalSaleAmountRound.toLocaleString() },
        { header: 'COGS', key: 'cogsAmountRound', align: 'right', render: (row) => row.cogsAmountRound.toLocaleString() },
        { header: 'Gross Profit', key: 'grossProfitRound', align: 'right', render: (row) => row.grossProfitRound.toLocaleString() },
        { header: 'Margin', key: 'profitMargin', align: 'right', render: (row) => `${row.profitMargin.toFixed(1)}%` },
      ];
    }
  }, [activeTab]);

  const printableSummaryData = useMemo(() => {
    if (activeTab === 'cogs') {
      return {
        'Total Revenue': summary.totalSalesRevenue,
        'Total COGS': summary.totalCOGS,
        'Average COGS': summary.averageCOGS,
        'Total Invoices': summary.totalInvoices,
      };
    } else {
      return {
        'Total Revenue': summary.totalSalesRevenue,
        'Total COGS': summary.totalCOGS,
        'Gross Profit': summary.totalGrossProfit,
        'Profit Margin': `${summary.overallProfitMargin.toFixed(1)}%`,
      };
    }
  }, [activeTab, summary]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setCustomerId('');
    setDateFrom(initialFilters.dateFrom || '');
    setDateTo(initialFilters.dateTo || '');
  };

  const getDerivedTitle = () => {
    return activeTab === 'cogs' ? 'COGS Analysis Report' : 'Gross Profit Analysis Report';
  };

  const getDerivedSubtitle = () => {
    const fromStr = dateFrom ? new Date(dateFrom).toLocaleDateString() : 'All Time';
    const toStr = dateTo ? new Date(dateTo).toLocaleDateString() : 'Present';
    return `Period: ${fromStr} to ${toStr}`;
  };

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title={getDerivedTitle()}
        subtitle={getDerivedSubtitle()}
        maxWidth="2xl"
        variant="scrollable"
        headerExtra={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refetch}
              disabled={isFetching}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
              title="Refresh Report Data"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin text-primary-500' : ''}`} />
            </button>
            <ExcelExportButton getData={getExportData} label="Excel" />
            <PdfExportButton getData={getExportData} label="PDF" />
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPrintOpen(true)}
              className="flex items-center gap-1.5 h-10 border-gray-200 hover:bg-gray-50 text-gray-700"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline font-semibold">Print</span>
            </Button>
          </div>
        }
      >
        <div className="p-5 space-y-5">
          {/* Tabs Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('cogs')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'cogs'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              COGS Analysis
            </button>
            <button
              onClick={() => setActiveTab('profit')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'profit'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Profit Analysis
            </button>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex-1 min-w-0">
              <DateFilter
                startDate={dateFrom}
                endDate={dateTo}
                onDateChange={(start, end) => {
                  setDateFrom(start || '');
                  setDateTo(end || '');
                }}
                compact={true}
                showPresets={true}
                showLabel={false}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search invoice / customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input h-10 w-full pl-9 bg-white border-gray-200 text-sm rounded-lg"
                />
              </div>

              <div className="w-full sm:w-64 relative">
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="input h-10 w-full bg-white border-gray-200 text-sm rounded-lg pl-9 pr-8"
                >
                  <option value="">All Customers</option>
                  {customers.map((c) => {
                    const id = c.id || c._id;
                    return (
                      <option key={id} value={id}>
                        {c.businessName || c.business_name || c.name}
                      </option>
                    );
                  })}
                </select>
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={handleClearFilters}
              className="text-xs text-gray-500 hover:text-gray-700 font-semibold"
            >
              Clear Filters
            </Button>
          </div>

          {/* Summary Dashboard cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider truncate">Revenue</span>
                <DollarSign className="h-4 w-4 text-emerald-600 shrink-0" />
              </div>
              <div className="mt-2 text-base font-extrabold text-slate-900 font-mono">
                {Math.round(summary.totalSalesRevenue).toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider truncate">Total COGS</span>
                <TrendingDown className="h-4 w-4 text-amber-600 shrink-0" />
              </div>
              <div className="mt-2 text-base font-extrabold text-slate-900 font-mono">
                {Math.round(summary.totalCOGS).toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider truncate">Gross Profit</span>
                <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
              </div>
              <div className="mt-2 text-base font-extrabold text-green-600 font-mono">
                {Math.round(summary.totalGrossProfit).toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider truncate">Profit Margin</span>
                <Percent className="h-4 w-4 text-blue-600 shrink-0" />
              </div>
              <div className="mt-2 text-base font-extrabold text-blue-600 font-mono">
                {summary.overallProfitMargin.toFixed(2)}%
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider truncate">Invoices</span>
                <Receipt className="h-4 w-4 text-indigo-600 shrink-0" />
              </div>
              <div className="mt-2 text-base font-extrabold text-indigo-600 font-mono">
                {summary.totalInvoices}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider truncate">Avg COGS/Inv</span>
                <DollarSign className="h-4 w-4 text-purple-600 shrink-0" />
              </div>
              <div className="mt-2 text-base font-extrabold text-purple-600 font-mono">
                {Math.round(summary.averageCOGS).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  {activeTab === 'cogs' ? (
                    <tr>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice Number</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Name</th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Sale Amount</th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Product Cost</th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">COGS Amount</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice Number</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Name</th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Sale Amount</th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total COGS</th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Profit</th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Profit Margin</th>
                    </tr>
                  )}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={activeTab === 'cogs' ? 6 : 7} className="px-6 py-12 text-center">
                        <LoadingInline message="Calculating costs and margins..." />
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={activeTab === 'cogs' ? 6 : 7} className="px-6 py-12 text-center text-red-600 font-semibold">
                        Failed to calculate report metrics. Please check network/server connection.
                      </td>
                    </tr>
                  ) : formattedData.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === 'cogs' ? 6 : 7} className="px-6 py-12 text-center text-gray-500">
                        No transactions found for the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    formattedData.map((row, index) => (
                      <tr key={row.id || index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {row.invoiceNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.formattedDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-[200px]" title={row.customerName}>
                          {row.customerName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 text-right">
                          {row.totalSaleAmountRound.toLocaleString()}
                        </td>
                        {activeTab === 'cogs' ? (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 text-right">
                              {row.totalProductCostRound.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 text-right">
                              {row.cogsAmountRound.toLocaleString()}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 text-right">
                              {row.cogsAmountRound.toLocaleString()}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono text-right font-semibold ${
                              row.grossProfitRound >= 0 ? 'text-green-600' : 'text-rose-600'
                            }`}>
                              {row.grossProfitRound.toLocaleString()}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono text-right font-semibold ${
                              row.profitMargin >= 0 ? 'text-green-600' : 'text-rose-600'
                            }`}>
                              {row.profitMargin.toFixed(2)}%
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </BaseModal>

      {/* Print Preview Modal */}
      {isPrintOpen && (
        <PrintReportModal
          isOpen={isPrintOpen}
          onClose={() => setIsPrintOpen(false)}
          reportTitle={getDerivedTitle()}
          data={formattedData}
          columns={printableColumns}
          filters={{
            dateFrom,
            dateTo,
          }}
          summaryData={printableSummaryData}
        />
      )}
    </>
  );
}
