import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { FileText, Search, TrendingDown, RefreshCw } from 'lucide-react';
import DateFilter from '../components/DateFilter';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { balanceSheetsApi, useGetLatestBalanceSheetQuery } from '../store/services/balanceSheetsApi';
import { formatCurrency } from '../utils/formatters';
import { getCurrentDatePakistan, getStartOfMonth, formatDatePakistan } from '../utils/dateUtils';

// Helper function to format date for display (using Pakistan timezone utilities)
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return formatDatePakistan(dateString);
  } catch (e) {
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

export const BalanceSheetStatement = () => {
  const dispatch = useDispatch();
  const today = getCurrentDatePakistan();
  const firstDayOfMonth = getStartOfMonth();

  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(today);
  const [searchFromDate, setSearchFromDate] = useState(firstDayOfMonth);
  const [searchToDate, setSearchToDate] = useState(today);
  const [showData, setShowData] = useState(false);

  const {
    data: latestBalanceSheetData,
    isLoading,
    isFetching,
    error
  } = useGetLatestBalanceSheetQuery(
    { asOfDate: searchToDate },
    { skip: !showData }
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
    if (new Date(toDate) > new Date(today)) {
      alert('To Date cannot be in the future');
      return;
    }
    setSearchFromDate(fromDate);
    setSearchToDate(toDate);
    setShowData(true);
  };

  const handleRefresh = () => {
    if (!showData) return;
    dispatch(
      balanceSheetsApi.endpoints.getLatestBalanceSheet.initiate(
        { asOfDate: searchToDate },
        { forceRefetch: true }
      )
    );
  };

  const balanceSheet = latestBalanceSheetData?.data || latestBalanceSheetData;
  const assets = balanceSheet?.assets || {};
  const liabilities = balanceSheet?.liabilities || {};
  const equity = balanceSheet?.equity || {};

  const totalAssets = Number(assets?.totalAssets || 0);
  const totalLiabilities = Number(liabilities?.totalLiabilities || 0);
  const totalEquity = Number(equity?.totalEquity || 0);
  const balanceDifference = totalAssets - (totalLiabilities + totalEquity);
  const isBalanced = Math.abs(balanceDifference) < 0.01;

  const cashAndBank = assets?.currentAssets?.cashAndCashEquivalents || {};
  const cashValue = Number(cashAndBank.cash ?? cashAndBank.cashOnHand ?? cashAndBank.total ?? 0);
  const bankValue = Number(cashAndBank.bank ?? cashAndBank.banks ?? 0);
  const inventoryValue = Number(assets?.currentAssets?.inventory?.total ?? assets?.currentAssets?.inventory ?? 0);
  const receivableValue = Number(
    assets?.currentAssets?.accountsReceivable?.netReceivables ??
      assets?.currentAssets?.accountsReceivable?.total ??
      assets?.currentAssets?.accountsReceivable ??
      0
  );

  const equipmentValue = Number(
    assets?.fixedAssets?.propertyPlantEquipment?.equipment ??
      assets?.fixedAssets?.propertyPlantEquipment?.total ??
      assets?.fixedAssets?.propertyPlantEquipment ??
      0
  );
  const furnitureValue = Number(
    assets?.fixedAssets?.propertyPlantEquipment?.furniture ??
      assets?.fixedAssets?.furniture ??
      0
  );

  const totalCurrentAssets = Number(
    assets?.currentAssets?.totalCurrentAssets ??
      cashValue + bankValue + inventoryValue + receivableValue
  );
  const totalFixedAssets = Number(
    assets?.fixedAssets?.totalFixedAssets ?? equipmentValue + furnitureValue
  );

  const accountsPayableValue = Number(
    liabilities?.currentLiabilities?.accountsPayable?.total ??
      liabilities?.currentLiabilities?.accountsPayable ??
      0
  );
  const loansValue = Number(
    liabilities?.longTermLiabilities?.longTermDebt?.total ??
      liabilities?.currentLiabilities?.shortTermDebt?.total ??
      liabilities?.longTermLiabilities?.longTermDebt ??
      liabilities?.currentLiabilities?.shortTermDebt ??
      0
  );

  const ownerCapitalValue = Number(
    equity?.ownerCapital ??
      equity?.contributedCapital?.total ??
      equity?.totalEquity ??
      0
  );
  const retainedEarningsValue = Number(
    equity?.retainedEarnings?.endingRetainedEarnings ??
      equity?.retainedEarnings?.currentPeriodEarnings ??
      equity?.retainedEarnings?.total ??
      0
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-100">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white">
              <FileText className="h-6 w-6 text-gray-700" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Balance Sheet
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Financial position for selected period
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Date filter and Generate */}
      <section className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6 overflow-hidden no-print">
        <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Statement Period
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Select date range to generate report</p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={!showData || isButtonLoading}
            title={showData ? 'Reload balance sheet for this period' : 'Generate a report first'}
            className="inline-flex items-center justify-center gap-2 self-start sm:self-auto shrink-0 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching && showData ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
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
          <p className="mt-4 text-sm font-medium text-gray-600">Preparing balance sheet...</p>
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
              <p className="mt-1 text-sm text-gray-600">
                {error?.data?.message || error?.message || 'An error occurred while fetching balance sheet data.'}
              </p>
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
      {!isButtonLoading && !error && showData && balanceSheet && (
        <div id="balance-sheet-content" className="space-y-6">
          {/* Summary Cards */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Key metrics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Assets</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAssets)}</p>
                <p className="mt-1 text-xs text-gray-500">Current + Fixed Assets</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Liabilities</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalLiabilities)}</p>
                <p className="mt-1 text-xs text-gray-500">Short + Long-term</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Equity</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalEquity)}</p>
                <p className="mt-1 text-xs text-gray-500">Owner Capital + Retained</p>
              </div>
              <div className={`rounded-lg p-5 border shadow-sm ${isBalanced ? 'bg-gray-900 border-gray-900' : 'bg-white border-red-200'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isBalanced ? 'text-gray-400' : 'text-red-600'}`}>Balance Check</p>
                <p className={`text-xl font-bold ${isBalanced ? 'text-white' : 'text-red-600'}`}>
                  {formatCurrency(balanceDifference)}
                </p>
                <p className={`mt-1 text-xs ${isBalanced ? 'text-gray-400' : 'text-red-600'}`}>
                  Assets {isBalanced ? 'match' : 'do not match'} L + E
                </p>
              </div>
            </div>
          </section>

          {/* Statement Tables */}
          <section className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-4 sm:px-6 border-b border-gray-200">
                  <h2 className="text-base font-semibold text-gray-900">Assets</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{formatDate(searchToDate)}</p>
                </div>
                <div className="overflow-x-auto flex-grow">
                  <table className="w-full text-left min-w-[360px]">
                    <tbody className="divide-y divide-gray-200">
                      <tr className="bg-gray-100">
                        <td colSpan="2" className="px-4 py-3 sm:px-6 font-semibold text-gray-700 text-xs uppercase tracking-wider">
                          Current Assets
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 sm:px-6 text-gray-600">Cash</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(cashValue)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 sm:px-6 text-gray-600">Bank</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(bankValue)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 sm:px-6 text-gray-600">Inventory (Stock)</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(inventoryValue)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 sm:px-6 text-gray-600">Accounts Receivable</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(receivableValue)}</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-4 py-3 sm:px-6 font-semibold text-gray-800">Total Current Assets</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(totalCurrentAssets)}</td>
                      </tr>
                      <tr className="bg-gray-100">
                        <td colSpan="2" className="px-4 py-3 sm:px-6 font-semibold text-gray-700 text-xs uppercase tracking-wider">
                          Fixed Assets
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 sm:px-6 text-gray-600">Equipment</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(equipmentValue)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 sm:px-6 text-gray-600">Furniture</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(furnitureValue)}</td>
                      </tr>
                      <tr className="bg-gray-50 border-b">
                        <td className="px-4 py-3 sm:px-6 font-semibold text-gray-800">Total Fixed Assets</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(totalFixedAssets)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="bg-gray-900 px-4 py-5 sm:px-6 flex items-center justify-between border-t border-gray-800">
                  <span className="text-white font-bold uppercase text-xs tracking-wider">Total Assets</span>
                  <span className="text-right font-bold text-xl text-green-400 tabular-nums">{formatCurrency(totalAssets)}</span>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-4 sm:px-6 border-b border-gray-200">
                  <h2 className="text-base font-semibold text-gray-900">Liabilities &amp; Equity</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{formatDate(searchToDate)}</p>
                </div>
                <div className="overflow-x-auto flex-grow">
                  <table className="w-full text-left min-w-[360px]">
                    <tbody className="divide-y divide-gray-200">
                      <tr className="bg-gray-100">
                        <td colSpan="2" className="px-4 py-3 sm:px-6 font-semibold text-gray-700 text-xs uppercase tracking-wider">
                          Liabilities
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 sm:px-6 text-gray-600">Accounts Payable</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(accountsPayableValue)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 sm:px-6 text-gray-600">Loans</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-right font-semibold text-gray-900">{formatCurrency(loansValue)}</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-4 py-3 sm:px-6 font-semibold text-gray-800">Total Liabilities</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(totalLiabilities)}</td>
                      </tr>
                      <tr className="bg-gray-100">
                        <td colSpan="2" className="px-4 py-3 sm:px-6 font-semibold text-gray-700 text-xs uppercase tracking-wider">
                          Equity
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 sm:px-6 text-gray-600">Owner Capital</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(ownerCapitalValue)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 sm:px-6 text-gray-600">Retained Earnings</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(retainedEarningsValue)}</td>
                      </tr>
                      <tr className="bg-gray-50 border-b">
                        <td className="px-4 py-3 sm:px-6 font-semibold text-gray-800">Total Equity</td>
                        <td className="px-4 py-3 sm:px-6 text-right font-semibold text-gray-900">{formatCurrency(totalEquity)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="bg-gray-900 px-4 py-5 sm:px-6 flex items-center justify-between border-t border-gray-800">
                  <span className="text-white font-bold uppercase text-xs tracking-wider">Total Liabilities + Equity</span>
                  <span className="text-right font-bold text-xl text-green-400 tabular-nums">
                    {formatCurrency(totalLiabilities + totalEquity)}
                  </span>
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
            Select a date range above and click Generate to view your Balance Sheet.
          </p>
        </section>
      )}
    </div>
  );
};

export default BalanceSheetStatement;
