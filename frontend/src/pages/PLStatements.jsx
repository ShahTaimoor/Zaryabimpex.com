import React, { useState } from 'react';
import {
  TrendingUp,
  Search,
  TrendingDown,
  FileText,

  AlertCircle,
} from 'lucide-react';
import { useGetSummaryQuery } from '../store/services/plStatementsApi';
import { handleApiError } from '../utils/errorHandler';
import { LoadingSpinner } from '../components/LoadingSpinner';
import PageShell from '../components/PageShell';
import { formatCurrency } from '../utils/formatters';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, getStartOfMonth, formatDatePakistan } from '../utils/dateUtils';

// Helper function to format date for display (using Pakistan timezone utilities)
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return formatDatePakistan(dateString);
  } catch (e) {
    // Fallback to simple formatting
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    return dateString;
  }
};

export const PLStatements = () => {
  // Get first day of current month and today
  const today = getCurrentDatePakistan();
  const firstDayOfMonth = getStartOfMonth();

  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(today);
  const [searchFromDate, setSearchFromDate] = useState(firstDayOfMonth);
  const [searchToDate, setSearchToDate] = useState(today);
  const [showData, setShowData] = useState(false);

  // Fetch P&L summary when search is clicked (skip until showData is true)
  const { data: summaryData, isLoading, isFetching, error } = useGetSummaryQuery(
    {
      startDate: searchFromDate,
      endDate: searchToDate,
    },
    {
      skip: !showData, // Only fetch when showData is true
      onError: (error) => handleApiError(error, 'Profit & Loss Statement'),
    }
  );

  const isButtonLoading = isLoading || isFetching;

  const handleSearch = () => {
    if (!fromDate || !toDate) {
      alert('Please select both From Date and To Date');
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      alert('From Date cannot be after To Date');
      return;
    }
    setSearchFromDate(fromDate);
    setSearchToDate(toDate);
    setShowData(true);
    // Query runs automatically when showData becomes true; when dates change, new args trigger a refetch
  };



  // Extract summary data - handle different response structures
  const summary = summaryData?.data || summaryData;

  // Extract values from summary - handle both direct values and nested structure
  // Backend pl-statements/summary returns: revenue, returns, grossProfit, operatingExpenses, netIncome
  const salesRevenue = summary?.revenue?.salesRevenue ?? summary?.statement?.revenue?.salesRevenue ?? 0;
  const salesReturns = summary?.returns?.salesReturns ?? summary?.revenue?.salesReturns ?? summary?.statement?.returns?.salesReturns ?? 0;
  const otherIncome = summary?.revenue?.otherIncome ?? summary?.statement?.revenue?.otherIncome ?? 0;
  const totalRevenue = (summary?.revenue?.totalRevenue?.amount ?? summary?.revenue?.total) ?? (summary?.statement?.revenue?.totalRevenue?.amount ?? summary?.totalRevenue) ?? (salesRevenue - salesReturns + otherIncome);
  const grossProfit = (summary?.grossProfit?.amount ?? summary?.grossProfit) ?? summary?.statement?.grossProfit?.amount ?? 0;
  const operatingExpensesTotal = (summary?.operatingExpenses?.total ?? summary?.operatingExpenses) ?? 0;
  const operatingIncome = (summary?.operatingIncome?.amount ?? (typeof summary?.operatingIncome === 'number' ? summary.operatingIncome : (grossProfit - operatingExpensesTotal))) ?? summary?.statement?.operatingIncome?.amount ?? (grossProfit - operatingExpensesTotal);
  const netIncome = (summary?.netIncome?.amount ?? summary?.netIncome) ?? summary?.statement?.netIncome?.amount ?? 0;
  // Margins: use API when provided, else compute from amounts (backend may not return margin %)
  const rev = Number(totalRevenue) || 0;
  const grossMargin =
    summary?.grossProfit?.margin ?? summary?.statement?.grossProfit?.margin ?? summary?.grossMargin ??
    (rev > 0 ? (Number(grossProfit) / rev) * 100 : 0);
  const operatingMargin =
    summary?.operatingIncome?.margin ?? summary?.statement?.operatingIncome?.margin ?? summary?.operatingMargin ??
    (rev > 0 ? (Number(operatingIncome) / rev) * 100 : 0);
  const netMargin =
    summary?.netIncome?.margin ?? summary?.statement?.netIncome?.margin ?? summary?.netMargin ??
    (rev > 0 ? (Number(netIncome) / rev) * 100 : 0);

  return (
    <PageShell className="bg-gray-100" maxWidthClassName="max-w-6xl" contentClassName="p-4 sm:p-6 lg:p-8">
      {/* Step 1: Header */}
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white">
              <FileText className="h-6 w-6 text-gray-700" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Profit & Loss Statement
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Financial performance for selected period
              </p>
            </div>
          </div>

        </div>
      </header>

      {/* Step 2: Date filter and Generate */}
      <section className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6 overflow-hidden no-print">
        <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Statement Period
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Select date range to generate report</p>
        </div>
        <div className="px-4 py-4 sm:px-6 sm:py-5 bg-gray-50 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="flex-1 min-w-0">
              <DateFilter
                startDate={fromDate}
                endDate={toDate}
                onDateChange={(start, end) => {
                  setFromDate(start || '');
                  setToDate(end || '');
                }}
                compact={true}
                showPresets={true}
                className="w-full"
              />
            </div>
            <div className="sm:w-48 shrink-0">
              <button
                onClick={handleSearch}
                disabled={isButtonLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 border border-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isButtonLoading ? (
                  <LoadingSpinner className="h-5 w-5 border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Loading State */}
      {showData && isButtonLoading && (
        <div className="flex flex-col items-center justify-center py-24 bg-white border border-gray-200 rounded-lg shadow-sm">
          <LoadingSpinner />
          <p className="mt-4 text-sm font-medium text-gray-600">Calculating financial data...</p>
        </div>
      )}

      {/* Error State */}
      {showData && error && (
        <div className="bg-white border border-red-300 rounded-lg p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900">Unable to generate statement</h3>
              <p className="mt-1 text-sm text-gray-600">{error?.data?.message || error?.message || 'An error occurred while fetching financial data.'}</p>
              <button
                onClick={handleSearch}
                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Content */}
      {!isButtonLoading && !error && showData && summary && (
        <div id="pl-statement-content" className="space-y-6">
          {/* Step 3: Summary Cards */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Key metrics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Gross Revenue</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
                <p className="mt-1 text-xs text-gray-500">Total sales income</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Gross Profit</p>
                <p className={`text-xl font-bold ${grossProfit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(grossProfit)}</p>
                <p className="mt-1 text-xs text-gray-500">{grossMargin?.toFixed(1) || 0}% margin</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Operating Income</p>
                <p className={`text-xl font-bold ${operatingIncome >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(operatingIncome)}</p>
                <p className="mt-1 text-xs text-gray-500">{operatingMargin?.toFixed(1) || 0}% margin</p>
              </div>
              <div className={`rounded-lg p-5 border shadow-sm ${netIncome >= 0 ? 'bg-gray-900 border-gray-900' : 'bg-white border-red-200'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${netIncome >= 0 ? 'text-gray-400' : 'text-red-600'}`}>Net Profit / Loss</p>
                <p className={`text-xl font-bold ${netIncome >= 0 ? 'text-white' : 'text-red-600'}`}>{formatCurrency(netIncome)}</p>
                <p className={`mt-1 text-xs ${netIncome >= 0 ? 'text-gray-400' : 'text-red-600'}`}>{netMargin?.toFixed(1) || 0}% net margin</p>
              </div>
            </div>
          </section>

          {/* Step 4: Statement Table */}
          <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-4 sm:px-6 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Statement of Financial Performance</h2>
              <p className="text-sm text-gray-500 mt-0.5">{formatDate(searchFromDate)} – {formatDate(searchToDate)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[400px]">
                <tbody className="divide-y divide-gray-200">
                  <tr className="bg-gray-100">
                    <td colSpan="2" className="px-4 py-3 sm:px-6 font-semibold text-gray-700 text-xs uppercase tracking-wider">Revenue</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-3 sm:px-6 text-gray-600">Operating Revenue / Sales</td>
                    <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(salesRevenue || totalRevenue)}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 sm:px-6 font-semibold text-gray-800">Total Gross Revenue</td>
                    <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(salesRevenue || totalRevenue)}</td>
                  </tr>
                  {(salesReturns > 0 || (summary?.returns?.totalReturns ?? 0) > 0) && (
                    <>
                      <tr className="bg-gray-100">
                        <td colSpan="2" className="px-4 py-3 sm:px-6 font-semibold text-gray-700 text-xs uppercase tracking-wider">Returns</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 sm:px-6 text-gray-600">Sales Returns</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-red-600">({formatCurrency(salesReturns || summary?.returns?.salesReturns || 0)})</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-4 py-3 sm:px-6 font-semibold text-gray-800">Total Returns</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-red-600">({formatCurrency(summary?.returns?.totalReturns ?? salesReturns ?? 0)})</td>
                      </tr>
                    </>
                  )}
                  {otherIncome > 0 && (
                    <tr>
                      <td className="px-4 py-3 sm:px-6 text-gray-600">Other Income</td>
                      <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(otherIncome)}</td>
                    </tr>
                  )}
                  <tr className="bg-gray-100 border-t-2 border-gray-200">
                    <td className="px-4 py-3 sm:px-6 font-bold text-gray-900">Total Revenue (Net of Returns)</td>
                    <td className="px-4 py-3 sm:px-6 text-right font-bold text-gray-900">{formatCurrency(totalRevenue)}</td>
                  </tr>
                  <tr className="bg-gray-100">
                    <td colSpan="2" className="px-4 py-3 sm:px-6 font-semibold text-gray-700 text-xs uppercase tracking-wider">Operating Expenses</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 sm:px-6 text-gray-600">Cost of Goods Sold (COGS)</td>
                    <td className="px-4 py-3 sm:px-6 text-right font-semibold text-red-600">({formatCurrency(totalRevenue - grossProfit)})</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 sm:px-6 font-semibold text-gray-800">Gross Profit</td>
                    <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(grossProfit)}</td>
                  </tr>
                  {operatingIncome !== undefined && (
                    <>
                      <tr>
                        <td className="px-4 py-3 sm:px-6 text-gray-600">Selling, General & Administrative</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-red-600">({formatCurrency(grossProfit - operatingIncome)})</td>
                      </tr>
                      <tr className="bg-gray-100 border-t border-gray-200">
                        <td className="px-4 py-3 sm:px-6 font-bold text-gray-900 uppercase text-xs tracking-wider">Operating Income (EBIT)</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-bold text-gray-900">{formatCurrency(operatingIncome)}</td>
                      </tr>
                    </>
                  )}
                  <tr className="bg-gray-900">
                    <td className="px-4 py-4 sm:px-6 text-white font-bold uppercase text-xs tracking-wider">Net Profit / Loss for the Period</td>
                    <td className={`px-4 py-4 sm:px-6 text-right font-bold text-lg ${netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(netIncome)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Step 5: Notes & Analysis */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-gray-500" />
                Notes on this Report
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="inline-block w-1.5 h-1.5 shrink-0 rounded-full bg-gray-400 mt-1.5" />
                  <span><strong className="text-gray-800">Sales Revenue</strong> matches the total of Sales Invoices for the selected period.</span>
                </li>
                <li className="flex gap-2">
                  <span className="inline-block w-1.5 h-1.5 shrink-0 rounded-full bg-gray-400 mt-1.5" />
                  <span><strong className="text-gray-800">Net Profit / Loss</strong> is revenue minus COGS and expenses, not the invoice total.</span>
                </li>
                <li className="flex gap-2">
                  <span className="inline-block w-1.5 h-1.5 shrink-0 rounded-full bg-gray-400 mt-1.5" />
                  <span>Values are based on approved transactions in the selected date range.</span>
                </li>
                <li className="flex gap-2">
                  <span className="inline-block w-1.5 h-1.5 shrink-0 rounded-full bg-gray-400 mt-1.5" />
                  <span>COGS uses the moving average cost method.</span>
                </li>
                <li className="flex gap-2">
                  <span className="inline-block w-1.5 h-1.5 shrink-0 rounded-full bg-gray-400 mt-1.5" />
                  <span>Margins are relative to total gross revenue. Report follows accrual accounting principles.</span>
                </li>
              </ul>
            </div>
            <div className="bg-gray-900 border border-gray-900 rounded-lg p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Analysis Summary</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-400 mb-1.5">
                    <span>Net Margin</span>
                    <span>{netMargin?.toFixed(0) || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${Math.max(0, Math.min(100, netMargin || 0))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Empty State */}
      {!showData && (
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm py-16 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-200 bg-gray-50 mx-auto mb-6">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Ready to generate your report</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Select a date range above and click Generate to view your Profit &amp; Loss statement.
          </p>
        </section>
      )}
    </PageShell>
  );
};

export default PLStatements;
