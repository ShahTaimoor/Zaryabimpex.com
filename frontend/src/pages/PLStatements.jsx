import React, { useState } from 'react';
import {
  TrendingUp,
  Search,
  TrendingDown,
  FileText,
  Download,
  AlertCircle,
} from 'lucide-react';
import { useGetSummaryQuery } from '../store/services/plStatementsApi';
import { handleApiError } from '../utils/errorHandler';
import { LoadingSpinner } from '../components/LoadingSpinner';
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

  const handleExportPDF = () => {
    if (!showData || !summary) {
      alert('Please generate a statement first before exporting.');
      return;
    }

    const printWindow = window.open('', '_blank');
    const printStyles = `
      <style>
        @page {
          size: A4;
          margin: 20mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #1e293b;
          background: white;
          line-height: 1.5;
        }
        .print-header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e2e8f0;
        }
        .print-header h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
        }
        .print-header p {
          font-size: 14px;
          color: #64748b;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 30px;
        }
        .summary-card {
          border: 1px solid #e2e8f0;
          padding: 16px;
          background: white;
        }
        .summary-card-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          margin-bottom: 8px;
        }
        .summary-card-value {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .summary-card-detail {
          font-size: 11px;
          color: #64748b;
        }
        .statement-table-wrapper {
          margin-top: 30px;
        }
        .statement-header {
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .statement-header h2 {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .statement-header p {
          font-size: 12px;
          color: #64748b;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 0;
        }
        tbody tr.section-header td {
          background-color: #f1f5f9;
          padding: 10px 16px;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #475569;
          border-bottom: 1px solid #e2e8f0;
        }
        tbody tr.data-row td {
          padding: 12px 16px;
          font-size: 14px;
          border-bottom: 1px solid #f1f5f9;
        }
        tbody tr.data-row:first-child td {
          padding-top: 16px;
        }
        tbody tr.summary-row td {
          background-color: #f8fafc;
          padding: 14px 16px;
          font-weight: 600;
          border-top: 2px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }
        tbody tr.final-row td {
          background-color: #0f172a;
          color: white;
          padding: 18px 16px;
          font-weight: 700;
          font-size: 16px;
          border: none;
        }
        tbody tr.final-row td:first-child {
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 14px;
        }
        td.label-cell {
          color: #475569;
          font-weight: 500;
        }
        td.value-cell {
          text-align: right;
          font-weight: 700;
          color: #0f172a;
        }
        td.value-positive {
          color: #059669;
        }
        td.value-negative {
          color: #dc2626;
        }
        svg {
          display: none !important;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            padding: 0;
          }
          .summary-grid {
            page-break-inside: avoid;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      </style>
    `;

    // Format the summary cards as HTML
    const summaryHTML = `
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-card-label">Gross Revenue</div>
          <div class="summary-card-value">${formatCurrency(totalRevenue)}</div>
          <div class="summary-card-detail">Total Sales income</div>
        </div>
        <div class="summary-card">
          <div class="summary-card-label">Gross Profit</div>
          <div class="summary-card-value">${formatCurrency(grossProfit)}</div>
          <div class="summary-card-detail">${grossMargin?.toFixed(1) || 0}% margin</div>
        </div>
        <div class="summary-card">
          <div class="summary-card-label">Operating Income</div>
          <div class="summary-card-value">${formatCurrency(operatingIncome)}</div>
          <div class="summary-card-detail">${operatingMargin?.toFixed(1) || 0}% margin</div>
        </div>
        <div class="summary-card" style="background-color: ${netIncome >= 0 ? '#0f172a' : '#ffffff'}; border-color: ${netIncome >= 0 ? '#0f172a' : '#fca5a5'};">
          <div class="summary-card-label" style="color: ${netIncome >= 0 ? '#94a3b8' : '#dc2626'};">Net Profit / Loss</div>
          <div class="summary-card-value" style="color: ${netIncome >= 0 ? '#ffffff' : '#dc2626'};">${formatCurrency(netIncome)}</div>
          <div class="summary-card-detail" style="color: ${netIncome >= 0 ? '#94a3b8' : '#dc2626'};">${netMargin?.toFixed(1) || 0}% net margin</div>
        </div>
      </div>
    `;

    const pdfSalesReturns = salesReturns || 0;
    const tableHTML = `
      <table>
        <tbody>
          <tr class="section-header">
            <td colspan="2">Revenue</td>
          </tr>
          <tr class="data-row">
            <td class="label-cell">Operating Revenue / Sales</td>
            <td class="value-cell">${formatCurrency(salesRevenue || totalRevenue)}</td>
          </tr>
          <tr class="summary-row">
            <td class="label-cell">Total Gross Revenue</td>
            <td class="value-cell">${formatCurrency(salesRevenue || totalRevenue)}</td>
          </tr>
          ${pdfSalesReturns > 0 ? `
          <tr class="section-header" style="background-color: #fffbeb;">
            <td colspan="2">Returns</td>
          </tr>
          <tr class="data-row">
            <td class="label-cell">Sales Returns</td>
            <td class="value-cell value-negative">(${formatCurrency(pdfSalesReturns)})</td>
          </tr>
          <tr class="summary-row" style="background-color: #fffbeb;">
            <td class="label-cell">Total Returns</td>
            <td class="value-cell value-negative">(${formatCurrency(pdfSalesReturns)})</td>
          </tr>
          ` : ''}
          ${otherIncome > 0 ? `
          <tr class="data-row">
            <td class="label-cell">Other Income</td>
            <td class="value-cell">${formatCurrency(otherIncome)}</td>
          </tr>
          ` : ''}
          <tr class="summary-row" style="font-weight: 700;">
            <td class="label-cell">Total Revenue (Net of Returns)</td>
            <td class="value-cell">${formatCurrency(totalRevenue)}</td>
          </tr>
          <tr class="section-header">
            <td colspan="2">Operating Expenses</td>
          </tr>
          <tr class="data-row">
            <td class="label-cell">Cost of Goods Sold (COGS)</td>
            <td class="value-cell value-negative">(${formatCurrency(totalRevenue - grossProfit)})</td>
          </tr>
          <tr class="summary-row">
            <td class="label-cell">Gross Profit</td>
            <td class="value-cell">${formatCurrency(grossProfit)}</td>
          </tr>
          ${operatingIncome !== undefined ? `
          <tr class="data-row">
            <td class="label-cell">Selling, General & Administrative</td>
            <td class="value-cell value-negative">(${formatCurrency(grossProfit - operatingIncome)})</td>
          </tr>
          <tr class="summary-row">
            <td class="label-cell">Operating Income (EBIT)</td>
            <td class="value-cell">${formatCurrency(operatingIncome)}</td>
          </tr>
          ` : ''}
          <tr class="final-row">
            <td>Net Profit / Loss for the Period</td>
            <td class="value-cell ${netIncome >= 0 ? 'value-positive' : 'value-negative'}" style="color: ${netIncome >= 0 ? '#10b981' : '#dc2626'};">
              ${formatCurrency(netIncome)}
            </td>
          </tr>
        </tbody>
      </table>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Profit & Loss Statement - ${formatDate(searchFromDate)} to ${formatDate(searchToDate)}</title>
          ${printStyles}
        </head>
        <body>
          <div class="print-header">
            <h1>Profit & Loss Statement</h1>
            <p>For the period ${formatDate(searchFromDate)} - ${formatDate(searchToDate)}</p>
          </div>
          ${summaryHTML}
          <div class="statement-table-wrapper">
            <div class="statement-header">
              <h2>Statement of Financial Performance</h2>
              <p>For the period ${formatDate(searchFromDate)} - ${formatDate(searchToDate)}</p>
            </div>
            ${tableHTML}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
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
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-100">
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
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportPDF}
              disabled={!showData || !summary || isButtonLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
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
    </div>
  );
};

export default PLStatements;
