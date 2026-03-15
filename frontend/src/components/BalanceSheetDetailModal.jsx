import React, { useState } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  CheckCircle,
  Clock,
  Edit,
  AlertCircle,
  BarChart3,
  PieChart
} from 'lucide-react';
import { useGetComparisonQuery } from '../store/services/balanceSheetsApi';
import { handleApiError } from '../utils/errorHandler';
import { LoadingSpinner } from '../components/LoadingSpinner';

import { useGetBalanceSheetQuery } from '../store/services/balanceSheetsApi';

const BalanceSheetDetailModal = ({
  balanceSheet,
  isOpen,
  onClose,
  onStatusUpdate,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [statusUpdateData, setStatusUpdateData] = useState({
    status: '',
    notes: ''
  });

  // Fetch full balance sheet data dynamically
  const {
    data: balanceSheetData,
    isLoading: balanceSheetLoading,
    error: balanceSheetError
  } = useGetBalanceSheetQuery(
    balanceSheet?._id,
    {
      skip: !isOpen || !balanceSheet?._id,
    }
  );

  // Use fetched data if available, otherwise fallback to prop
  const fullBalanceSheet = balanceSheetData?.data || balanceSheetData || balanceSheet;

  // Fetch comparison data
  const {
    data: comparisonData,
    isLoading: comparisonLoading
  } = useGetComparisonQuery(
    { id: fullBalanceSheet?._id, type: 'previous' },
    {
      skip: !isOpen || !fullBalanceSheet?._id,
    }
  );

  const getStatusIcon = (status) => {
    switch (status) {
      case 'draft':
        return <Edit className="h-4 w-4 text-gray-500" />;
      case 'review':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'final':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'review':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'final':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatPercentage = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  const handleStatusUpdate = (e) => {
    e.preventDefault();
    onStatusUpdate(statusUpdateData.status, statusUpdateData.notes);
    setShowStatusUpdate(false);
    setStatusUpdateData({ status: '', notes: '' });
  };

  const getChangeIcon = (change) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <div className="h-4 w-4" />;
  };

  const getChangeColor = (change) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (!isOpen || !fullBalanceSheet) {
    if (balanceSheetLoading) {
      return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
            <LoadingSpinner message="Loading balance sheet details..." />
          </div>
        </div>
      );
    }
    return null;
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'assets', label: 'Assets', icon: TrendingUp },
    { id: 'liabilities', label: 'Liabilities', icon: TrendingDown },
    { id: 'equity', label: 'Equity', icon: PieChart },
    { id: 'ratios', label: 'Ratios', icon: FileText }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-50 rounded-lg mr-4">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{fullBalanceSheet.statementNumber || 'Invalid Date'}</h3>
              <p className="text-sm text-gray-500">
                {fullBalanceSheet.statementDate
                  ? new Date(fullBalanceSheet.statementDate).toLocaleDateString()
                  : 'Invalid Date'} •
                <span className="capitalize ml-1">{fullBalanceSheet.periodType || 'N/A'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(fullBalanceSheet.status)}`}>
              {getStatusIcon(fullBalanceSheet.status)}
              <span className="ml-2 capitalize">{fullBalanceSheet.status || 'draft'}</span>
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-50 rounded-lg mr-3">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Assets</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(fullBalanceSheet.assets?.totalAssets || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-2 bg-red-50 rounded-lg mr-3">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Liabilities</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(fullBalanceSheet.liabilities?.totalLiabilities || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-50 rounded-lg mr-3">
                      <PieChart className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Equity</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(fullBalanceSheet.equity?.totalEquity || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Balance Check */}
              {(() => {
                const totalAssets = fullBalanceSheet.assets?.totalAssets || 0;
                const totalLiabilities = fullBalanceSheet.liabilities?.totalLiabilities || 0;
                const totalEquity = fullBalanceSheet.equity?.totalEquity || 0;
                const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

                return (
                  <div className={`p-4 rounded-lg border ${isBalanced
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-center">
                      {isBalanced ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                      )}
                      <span className={`font-medium ${isBalanced ? 'text-green-800' : 'text-red-800'
                        }`}>
                        {isBalanced ? 'Balance Sheet is Balanced' : 'Balance Sheet is Not Balanced'}
                      </span>
                    </div>
                    <p className={`text-sm mt-1 ${isBalanced ? 'text-green-700' : 'text-red-700'
                      }`}>
                      Assets: {formatCurrency(totalAssets)} =
                      Liabilities: {formatCurrency(totalLiabilities)} +
                      Equity: {formatCurrency(totalEquity)}
                    </p>
                  </div>
                );
              })()}

              {/* Comparison Data */}
              {comparisonData && (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Comparison with Previous Period</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">Total Assets</span>
                        {getChangeIcon(comparisonData.changes?.assets?.totalAssets?.change)}
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(comparisonData.changes?.assets?.totalAssets?.current)}
                      </p>
                      <p className={`text-sm ${getChangeColor(comparisonData.changes?.assets?.totalAssets?.change)}`}>
                        {getChangeIcon(comparisonData.changes?.assets?.totalAssets?.change)}
                        <span className="ml-1">
                          {formatCurrency(comparisonData.changes?.assets?.totalAssets?.change)}
                          ({formatPercentage(comparisonData.changes?.assets?.totalAssets?.percentageChange)})
                        </span>
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">Total Liabilities</span>
                        {getChangeIcon(comparisonData.changes?.liabilities?.totalLiabilities?.change)}
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(comparisonData.changes?.liabilities?.totalLiabilities?.current)}
                      </p>
                      <p className={`text-sm ${getChangeColor(comparisonData.changes?.liabilities?.totalLiabilities?.change)}`}>
                        {getChangeIcon(comparisonData.changes?.liabilities?.totalLiabilities?.change)}
                        <span className="ml-1">
                          {formatCurrency(comparisonData.changes?.liabilities?.totalLiabilities?.change)}
                          ({formatPercentage(comparisonData.changes?.liabilities?.totalLiabilities?.percentageChange)})
                        </span>
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">Total Equity</span>
                        {getChangeIcon(comparisonData.changes?.equity?.totalEquity?.change)}
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(comparisonData.changes?.equity?.totalEquity?.current)}
                      </p>
                      <p className={`text-sm ${getChangeColor(comparisonData.changes?.equity?.totalEquity?.change)}`}>
                        {getChangeIcon(comparisonData.changes?.equity?.totalEquity?.change)}
                        <span className="ml-1">
                          {formatCurrency(comparisonData.changes?.equity?.totalEquity?.change)}
                          ({formatPercentage(comparisonData.changes?.equity?.totalEquity?.percentageChange)})
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="space-y-6">
              <h4 className="text-lg font-medium text-gray-900">Assets Breakdown</h4>

              {/* Current Assets */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h5 className="text-md font-medium text-gray-900 mb-4">Current Assets</h5>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Cash and Cash Equivalents</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.assets?.currentAssets?.cashAndCashEquivalents?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Accounts Receivable</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.assets?.currentAssets?.accountsReceivable?.netReceivables || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Inventory</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.assets?.currentAssets?.inventory?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Prepaid Expenses</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.assets?.currentAssets?.prepaidExpenses || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-medium text-gray-900">Total Current Assets</span>
                    <span className="text-sm font-bold">{formatCurrency(fullBalanceSheet.assets?.currentAssets?.totalCurrentAssets || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Fixed Assets */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h5 className="text-md font-medium text-gray-900 mb-4">Fixed Assets</h5>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Property, Plant & Equipment</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.assets?.fixedAssets?.propertyPlantEquipment?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Less: Accumulated Depreciation</span>
                    <span className="text-sm font-medium">({formatCurrency(fullBalanceSheet.assets?.fixedAssets?.accumulatedDepreciation || 0)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Net Property, Plant & Equipment</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.assets?.fixedAssets?.netPropertyPlantEquipment || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Intangible Assets</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.assets?.fixedAssets?.intangibleAssets?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Long-term Investments</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.assets?.fixedAssets?.longTermInvestments || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-medium text-gray-900">Total Fixed Assets</span>
                    <span className="text-sm font-bold">{formatCurrency(fullBalanceSheet.assets?.fixedAssets?.totalFixedAssets || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-blue-900">TOTAL ASSETS</span>
                  <span className="text-lg font-bold text-blue-900">{formatCurrency(fullBalanceSheet.assets?.totalAssets || 0)}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'liabilities' && (
            <div className="space-y-6">
              <h4 className="text-lg font-medium text-gray-900">Liabilities Breakdown</h4>

              {/* Current Liabilities */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h5 className="text-md font-medium text-gray-900 mb-4">Current Liabilities</h5>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Accounts Payable</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.liabilities?.currentLiabilities?.accountsPayable?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Accrued Expenses</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.liabilities?.currentLiabilities?.accruedExpenses?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Short-term Debt</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.liabilities?.currentLiabilities?.shortTermDebt?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Deferred Revenue</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.liabilities?.currentLiabilities?.deferredRevenue || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-medium text-gray-900">Total Current Liabilities</span>
                    <span className="text-sm font-bold">{formatCurrency(fullBalanceSheet.liabilities?.currentLiabilities?.totalCurrentLiabilities || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Long-term Liabilities */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h5 className="text-md font-medium text-gray-900 mb-4">Long-term Liabilities</h5>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Long-term Debt</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.liabilities?.longTermLiabilities?.longTermDebt?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Deferred Tax Liabilities</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.liabilities?.longTermLiabilities?.deferredTaxLiabilities || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Pension Liabilities</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.liabilities?.longTermLiabilities?.pensionLiabilities || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-medium text-gray-900">Total Long-term Liabilities</span>
                    <span className="text-sm font-bold">{formatCurrency(fullBalanceSheet.liabilities?.longTermLiabilities?.totalLongTermLiabilities || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-red-900">TOTAL LIABILITIES</span>
                  <span className="text-lg font-bold text-red-900">{formatCurrency(fullBalanceSheet.liabilities?.totalLiabilities || 0)}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'equity' && (
            <div className="space-y-6">
              <h4 className="text-lg font-medium text-gray-900">Equity Breakdown</h4>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h5 className="text-md font-medium text-gray-900 mb-4">Shareholders' Equity</h5>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Common Stock</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.equity?.contributedCapital?.commonStock || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Preferred Stock</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.equity?.contributedCapital?.preferredStock || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Additional Paid-in Capital</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.equity?.contributedCapital?.additionalPaidInCapital || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-medium text-gray-900">Total Contributed Capital</span>
                    <span className="text-sm font-bold">{formatCurrency(fullBalanceSheet.equity?.contributedCapital?.total || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h5 className="text-md font-medium text-gray-900 mb-4">Retained Earnings</h5>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Beginning Retained Earnings</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.equity?.retainedEarnings?.beginningRetainedEarnings || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Current Period Earnings</span>
                    <span className="text-sm font-medium">{formatCurrency(fullBalanceSheet.equity?.retainedEarnings?.currentPeriodEarnings || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Dividends Paid</span>
                    <span className="text-sm font-medium">({formatCurrency(fullBalanceSheet.equity?.retainedEarnings?.dividendsPaid || 0)})</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-medium text-gray-900">Ending Retained Earnings</span>
                    <span className="text-sm font-bold">{formatCurrency(fullBalanceSheet.equity?.retainedEarnings?.endingRetainedEarnings || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-blue-900">TOTAL EQUITY</span>
                  <span className="text-lg font-bold text-blue-900">{formatCurrency(fullBalanceSheet.equity?.totalEquity || 0)}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ratios' && (
            <div className="space-y-6">
              <h4 className="text-lg font-medium text-gray-900">Financial Ratios</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Liquidity Ratios */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h5 className="text-md font-medium text-gray-900 mb-4">Liquidity Ratios</h5>
                  <div className="space-y-3">
                    <div className="flex justify_between">
                      <span className="text-sm text-gray-600">Current Ratio</span>
                      <span className="text-sm font-medium">{(fullBalanceSheet.financialRatios?.liquidity?.currentRatio || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Quick Ratio</span>
                      <span className="text-sm font-medium">{(fullBalanceSheet.financialRatios?.liquidity?.quickRatio || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cash Ratio</span>
                      <span className="text-sm font-medium">{(fullBalanceSheet.financialRatios?.liquidity?.cashRatio || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Leverage Ratios */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h5 className="text-md font-medium text-gray-900 mb-4">Leverage Ratios</h5>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Debt-to-Equity Ratio</span>
                      <span className="text-sm font-medium">{(fullBalanceSheet.financialRatios?.leverage?.debtToEquityRatio || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Debt-to-Asset Ratio</span>
                      <span className="text-sm font-medium">{(fullBalanceSheet.financialRatios?.leverage?.debtToAssetRatio || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Equity Ratio</span>
                      <span className="text-sm font-medium">{(fullBalanceSheet.financialRatios?.leverage?.equityRatio || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowStatusUpdate(true)}
              className="btn btn-secondary"
              disabled={isLoading}
            >
              Update Status
            </button>
            <button className="btn btn-secondary">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </button>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Close
          </button>
        </div>

        {/* Status Update Modal */}
        {showStatusUpdate && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Update Status</h3>
              <form onSubmit={handleStatusUpdate}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Status
                  </label>
                  <select
                    value={statusUpdateData.status}
                    onChange={(e) => setStatusUpdateData(prev => ({ ...prev, status: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  >
                    <option value="">Select Status</option>
                    <option value="review">Review</option>
                    <option value="approved">Approved</option>
                    <option value="final">Final</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={statusUpdateData.notes}
                    onChange={(e) => setStatusUpdateData(prev => ({ ...prev, notes: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    rows={3}
                    placeholder="Add any notes about this status change..."
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowStatusUpdate(false)}
                    className="flex-1 btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn btn-primary"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BalanceSheetDetailModal;

