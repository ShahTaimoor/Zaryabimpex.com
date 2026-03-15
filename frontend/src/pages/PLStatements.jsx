import React, { useState } from 'react';
import {
  TrendingUp,
  Calendar,
  Search,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  FileText,
  Download,
  AlertCircle,
} from 'lucide-react';
import { useGetSummaryQuery } from '../store/services/plStatementsApi';
import { handleApiError } from '../utils/errorHandler';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { formatCurrency } from '../utils/formatters';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, getStartOfMonth } from '../utils/dateUtils';

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

  // Fetch P&L summary when search is clicked
  const { data: summaryData, isLoading, isFetching, error, refetch } = useGetSummaryQuery(
    {
      startDate: searchFromDate,
      endDate: searchToDate,
    },
    {
      skip: !showData, // Only fetch when showData is true
      onError: (error) => handleApiError(error, 'Profit & Loss Statement'),
    }
  );
  
  // Use isFetching to show loading state on every refetch, not just initial load
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
    refetch();
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

    // Build formatted table HTML
    const tableHTML = `
      <table>
        <tbody>
          <tr class="section-header">
            <td colspan="2">Revenue</td>
          </tr>
          <tr class="data-row">
            <td class="label-cell">Operating Revenue / Sales</td>
            <td class="value-cell">${formatCurrency(totalRevenue)}</td>
          </tr>
          <tr class="summary-row">
            <td class="label-cell">Total Gross Revenue</td>
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
  // The backend might return a full statement object or just summary values
  const totalRevenue = summary?.revenue?.totalRevenue?.amount || 
                      summary?.statement?.revenue?.totalRevenue?.amount ||
                      summary?.totalRevenue || 0;
  const grossProfit = summary?.grossProfit?.amount || 
                     summary?.statement?.grossProfit?.amount ||
                     summary?.grossProfit || 0;
  const operatingIncome = summary?.operatingIncome?.amount || 
                         summary?.statement?.operatingIncome?.amount ||
                         summary?.operatingIncome || 0;
  const netIncome = summary?.netIncome?.amount || 
                   summary?.statement?.netIncome?.amount ||
                   summary?.netIncome || 0;
  const grossMargin = summary?.grossProfit?.margin || 
                     summary?.statement?.grossProfit?.margin ||
                     summary?.grossMargin;
  const operatingMargin = summary?.operatingIncome?.margin || 
                         summary?.statement?.operatingIncome?.margin ||
                         summary?.operatingMargin;
  const netMargin = summary?.netIncome?.margin || 
                   summary?.statement?.netIncome?.margin ||
                   summary?.netMargin;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-8 bg-gray-50/30 min-h-screen">
      {/* Header & Date Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden no-print">
        <div className="p-6 md:p-8 border-b border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center tracking-tight">
                <div className="bg-primary-100 p-2 rounded-lg mr-4">
                  <FileText className="h-6 w-6 text-primary-600" />
                </div>
                Profit & Loss Statement
              </h1>
              <p className="text-slate-500 mt-1 text-sm font-medium">Financial performance report and analysis</p>
            </div>
            
            <div className="flex items-center space-x-3 no-print">
              <button
                onClick={handleExportPDF}
                disabled={!showData || !summary || isButtonLoading}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-8">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Statement Period
              </label>
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

            <div className="md:col-span-4">
              <button
                onClick={handleSearch}
                disabled={isButtonLoading}
                className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isButtonLoading ? (
                  <LoadingSpinner className="h-5 w-5 border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <Search className="h-5 w-5" />
                    <span>Generate Statement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* States */}
      {showData && isButtonLoading && (
        <div className="flex flex-col justify-center items-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
          <LoadingSpinner />
          <p className="mt-4 text-slate-600 font-medium animate-pulse">Calculating financial data...</p>
        </div>
      )}

      {showData && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <div className="bg-red-100 p-2 rounded-lg mr-4">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-red-900">Unable to generate statement</h3>
          </div>
          <p className="text-red-700 text-sm mb-6">{error?.data?.message || error?.message || 'An error occurred while fetching financial data.'}</p>
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all"
          >
            Retry Calculation
          </button>
        </div>
      )}

      {/* Report Content */}
      {!isButtonLoading && !error && showData && summary && (
        <div id="pl-statement-content" className="space-y-8 animate-in fade-in duration-500">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Revenue</span>
                <div className="bg-emerald-50 p-1.5 rounded-md">
                  <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 leading-tight">
                {formatCurrency(totalRevenue)}
              </div>
              <div className="mt-2 text-xs font-medium text-slate-500 flex items-center">
                <span className="text-emerald-600 font-bold mr-1">Total Sales</span> income
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Profit</span>
                <div className="bg-blue-50 p-1.5 rounded-md">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className={`text-2xl font-bold leading-tight ${grossProfit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                {formatCurrency(grossProfit)}
              </div>
              <div className="mt-2 text-xs font-medium text-slate-500 flex items-center">
                <span className="text-blue-600 font-bold mr-1">{grossMargin?.toFixed(1) || 0}%</span> margin
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Operating Income</span>
                <div className="bg-indigo-50 p-1.5 rounded-md">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
              <div className={`text-2xl font-bold leading-tight ${operatingIncome >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                {formatCurrency(operatingIncome)}
              </div>
              <div className="mt-2 text-xs font-medium text-slate-500 flex items-center">
                <span className="text-indigo-600 font-bold mr-1">{operatingMargin?.toFixed(1) || 0}%</span> margin
              </div>
            </div>

            <div className={`p-6 rounded-xl border shadow-sm hover:shadow-md transition-all ${
              netIncome >= 0 
                ? 'bg-slate-900 border-slate-900' 
                : 'bg-white border-rose-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  netIncome >= 0 ? 'text-slate-400' : 'text-rose-500'
                }`}>Net Profit / Loss</span>
                <div className={`${netIncome >= 0 ? 'bg-slate-800' : 'bg-rose-50'} p-1.5 rounded-md`}>
                  {netIncome >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-rose-600" />
                  )}
                </div>
              </div>
              <div className={`text-2xl font-bold leading-tight ${
                netIncome >= 0 ? 'text-white' : 'text-rose-700'
              }`}>
                {formatCurrency(netIncome)}
              </div>
              <div className={`mt-2 text-xs font-medium flex items-center ${
                netIncome >= 0 ? 'text-slate-400' : 'text-rose-500'
              }`}>
                <span className={`font-bold mr-1 ${
                  netIncome >= 0 ? 'text-emerald-400' : 'text-rose-600'
                }`}>{netMargin?.toFixed(1) || 0}%</span> net margin
              </div>
            </div>
          </div>

          {/* Detailed Statement Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Statement of Financial Performance</h2>
              <p className="text-sm text-slate-500 font-medium">For the period {formatDate(searchFromDate)} - {formatDate(searchToDate)}</p>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left">
                <tbody>
                  {/* Revenue Section */}
                  <tr className="bg-slate-50/80">
                    <td colSpan="2" className="px-6 py-3 font-bold text-slate-800 uppercase text-xs tracking-wider">Revenue</td>
                  </tr>
                  <tr className="border-b border-slate-50">
                    <td className="px-6 py-4 text-slate-600 font-medium">Operating Revenue / Sales</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(totalRevenue)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 bg-slate-50/30">
                    <td className="px-6 py-4 text-slate-800 font-bold">Total Gross Revenue</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(totalRevenue)}</td>
                  </tr>

                  {/* Expenses Section */}
                  <tr className="bg-slate-50/80">
                    <td colSpan="2" className="px-6 py-3 font-bold text-slate-800 uppercase text-xs tracking-wider">Operating Expenses</td>
                  </tr>
                  <tr className="border-b border-slate-50">
                    <td className="px-6 py-4 text-slate-600 font-medium">Cost of Goods Sold (COGS)</td>
                    <td className="px-6 py-4 text-right font-bold text-rose-600">({formatCurrency(totalRevenue - grossProfit)})</td>
                  </tr>
                  <tr className="border-b border-slate-100 bg-slate-50/30">
                    <td className="px-6 py-4 text-slate-800 font-bold underline decoration-slate-200 decoration-2 underline-offset-4">Gross Profit</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(grossProfit)}</td>
                  </tr>

                  {/* Operating Income Section */}
                  {operatingIncome !== undefined && (
                    <>
                      <tr className="border-b border-slate-50">
                        <td className="px-6 py-4 text-slate-600 font-medium">Selling, General & Administrative</td>
                        <td className="px-6 py-4 text-right font-bold text-rose-600">({formatCurrency(grossProfit - operatingIncome)})</td>
                      </tr>
                      <tr className="border-b border-slate-200 bg-slate-100/50">
                        <td className="px-6 py-4 text-slate-900 font-extrabold text-base uppercase tracking-tight">Operating Income (EBIT)</td>
                        <td className="px-6 py-4 text-right font-extrabold text-slate-900 text-base">{formatCurrency(operatingIncome)}</td>
                      </tr>
                    </>
                  )}

                  {/* Net Income Summary */}
                  <tr className="bg-slate-900">
                    <td className="px-6 py-6 text-white font-extrabold text-lg tracking-tight uppercase">Net Profit / Loss for the Period</td>
                    <td className={`px-6 py-6 text-right font-extrabold text-2xl ${
                      netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {formatCurrency(netIncome)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Guidelines/Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 text-primary-500" />
                Notes on this Report
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                <li className="text-xs text-slate-600 flex items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2 mt-1 flex-shrink-0" />
                  Values are calculated based on all approved transactions within the selected dates.
                </li>
                <li className="text-xs text-slate-600 flex items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2 mt-1 flex-shrink-0" />
                  COGS is determined using the moving average cost method.
                </li>
                <li className="text-xs text-slate-600 flex items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2 mt-1 flex-shrink-0" />
                  Margins are calculated relative to total gross revenue.
                </li>
                <li className="text-xs text-slate-600 flex items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2 mt-1 flex-shrink-0" />
                  Report follows standard accrual accounting principles.
                </li>
              </ul>
            </div>
            
            <div className="bg-slate-900 rounded-xl p-6 text-white shadow-lg shadow-slate-200">
              <h4 className="text-sm font-bold mb-4 uppercase tracking-widest text-slate-400">Analysis Summary</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5 text-slate-300 uppercase">
                    <span>Efficiency</span>
                    <span>{netMargin?.toFixed(0) || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div 
                      className="bg-emerald-400 h-1.5 rounded-full" 
                      style={{ width: `${Math.max(0, Math.min(100, netMargin || 0))}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  The net profit margin indicates that for every dollar of revenue, the company retains ${((netMargin || 0) / 100).toFixed(2)} as profit.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!showData && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-20 text-center">
          <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="h-10 w-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Ready to generate your report</h3>
          <p className="text-slate-500 max-w-sm mx-auto font-medium">
            Select a date range above and click "Generate Statement" to view your business's financial performance.
          </p>
        </div>
      )}
    </div>
  );
};

export default PLStatements;
