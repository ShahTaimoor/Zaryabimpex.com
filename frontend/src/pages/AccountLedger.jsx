import React, { useState } from 'react';
import {
  Book,
  Search,
  Calendar,
  FileText,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  RefreshCw,
  FileDown,
  Printer
} from 'lucide-react';
import {
  useGetLedgerEntriesQuery,
  useGetAccountsListQuery,
  useGetAllEntriesQuery,
  useExportLedgerMutation,
} from '../store/services/accountLedgerApi';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { handleApiError } from '../utils/errorHandler';
import toast from 'react-hot-toast';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, getDateDaysAgo } from '../utils/dateUtils';

const AccountTypeBadge = ({ type }) => {
  const config = {
    asset: { bg: 'bg-green-100', text: 'text-green-800', label: 'Asset' },
    liability: { bg: 'bg-red-100', text: 'text-red-800', label: 'Liability' },
    equity: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Equity' },
    revenue: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Revenue' },
    expense: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Expense' }
  };

  const typeConfig = config[type] || config.asset;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeConfig.bg} ${typeConfig.text}`}>
      {typeConfig.label}
    </span>
  );
};

const AccountLedger = () => {
  // Function to get default date range (one month difference)
  const getDefaultDateRange = () => {
    return {
      startDate: getDateDaysAgo(30),
      endDate: getCurrentDatePakistan()
    };
  };

  const defaultDates = getDefaultDateRange();

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [filters, setFilters] = useState({
    startDate: defaultDates.startDate,
    endDate: defaultDates.endDate,
    accountCode: '',
    accountName: '',
    customerName: '',
    supplierName: ''
  });
  const [showFilters, setShowFilters] = useState(true);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportLedger] = useExportLedgerMutation();
  const { companyInfo } = useCompanyInfo();

  // Close export menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportMenu && !event.target.closest('.relative')) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  // Fetch all accounts list
  const { data: accountsData, isLoading: accountsLoading } = useGetAccountsListQuery(undefined, {
    onError: (error) => handleApiError(error, 'Error fetching accounts')
  });

  // Fetch ledger entries based on filters
  const { data: ledgerData, isLoading: ledgerLoading, refetch: refetchLedger } = useGetAllEntriesQuery(
    filters,
    {
      skip: !(filters.accountCode || filters.startDate || filters.endDate || filters.accountName),
      onError: (error) => handleApiError(error, 'Error fetching ledger entries')
    }
  );

  const handleAccountSelect = (account) => {
    setSelectedAccount(account);
    setFilters({ ...filters, accountCode: account.accountCode });
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleClearFilters = () => {
    setFilters({ startDate: defaultDates.startDate, endDate: defaultDates.endDate, accountCode: '', accountName: '' });
    setSelectedAccount(null);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleExport = async (format = 'csv') => {
    if (!ledgerData?.data?.entries?.length) {
      toast.error('No data to export');
      return;
    }

    try {
      setIsExporting(true);
      setShowExportMenu(false);

      // Build export params with current filters
      const params = {
        export: format,
      };

      // Add filters that have values
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.accountCode) params.accountCode = filters.accountCode;
      if (filters.accountName) params.accountName = filters.accountName;

      const result = await exportLedger(params).unwrap();

      // Get filename - generate one based on format and account
      const formatExtension = format === 'excel' ? 'xlsx' : format;
      let filename = `account-ledger-${selectedAccount?.accountCode || 'all'}-${new Date().toISOString().split('T')[0]}.${formatExtension}`;

      // Create blob and download
      // RTK Query with responseType: 'blob' returns the blob directly
      const blob = result instanceof Blob ? result : new Blob([result]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(`Ledger exported as ${format.toUpperCase()} successfully`);
    } catch (error) {
      handleApiError(error, 'Export ledger');
      toast.error('Failed to export ledger');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (accountsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const groupedAccounts = accountsData?.data?.groupedAccounts || {};
  const ledgerEntries = ledgerData?.data?.entries || [];
  const summary = ledgerData?.data?.summary || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Book className="h-8 w-8 mr-2 text-primary-600" />
            Account Ledger
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            View detailed transaction history for all accounts
          </p>
        </div>
        <div className="flex space-x-2 no-print">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary flex items-center"
          >
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          {ledgerEntries.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="btn btn-secondary flex items-center"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export'}
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200">
                  <div className="py-1">
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExport('excel')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Export as Excel
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Export as PDF
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Export as JSON
                    </button>
                    <div className="border-t border-gray-200 my-1"></div>
                    <button
                      onClick={handlePrint}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Print View
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => refetchLedger()}
            className="btn btn-primary flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Accounts List Sidebar */}
        <div className="col-span-12 lg:col-span-3 no-print">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Accounts
              </h2>
            </div>
            <div className="card-content p-0">
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search accounts..."
                    className="input pl-10"
                    value={accountSearchQuery}
                    onChange={(e) => setAccountSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                {Object.entries(groupedAccounts).map(([type, accountsList]) => {
                  // Filter accounts based on search query
                  const filteredAccounts = accountsList.filter(account => {
                    if (!accountSearchQuery.trim()) return true;
                    const query = accountSearchQuery.toLowerCase();
                    return (
                      account.accountCode.toLowerCase().includes(query) ||
                      account.accountName.toLowerCase().includes(query) ||
                      (account.description && account.description.toLowerCase().includes(query))
                    );
                  });

                  if (filteredAccounts.length === 0) return null;

                  return (
                    <div key={type} className="border-b last:border-b-0">
                      <div className="px-4 py-2 bg-gray-50 border-b">
                        <h3 className="font-medium text-sm text-gray-700 uppercase">
                          {type}
                        </h3>
                      </div>
                      <div>
                        {filteredAccounts.map((account) => (
                          <button
                            key={account._id}
                            onClick={() => handleAccountSelect(account)}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b last:border-b-0 ${selectedAccount?._id === account._id ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''
                              }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {account.accountCode}
                                </div>
                                <div className="text-xs text-gray-600 truncate">
                                  {account.accountName}
                                </div>
                                {account.transactionCount > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {account.transactionCount} transactions
                                  </div>
                                )}
                              </div>
                              <div className="text-right ml-2">
                                <div className={`text-sm font-semibold ${account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                  {formatCurrency(Math.abs(account.currentBalance))}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {accountSearchQuery.trim() && Object.values(groupedAccounts).flat().filter(account => {
                  const query = accountSearchQuery.toLowerCase();
                  return (
                    account.accountCode.toLowerCase().includes(query) ||
                    account.accountName.toLowerCase().includes(query) ||
                    (account.description && account.description.toLowerCase().includes(query))
                  );
                }).length === 0 && (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No accounts found matching "{accountSearchQuery}"
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* Ledger Entries */}
        <div className="col-span-12 lg:col-span-9">
          {/* Filters */}
          {showFilters && (
            <div className="card mb-6 no-print">
              <div className="card-header">
                <h3 className="text-lg font-semibold">Filters</h3>
              </div>
              <div className="card-content">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <DateFilter
                      startDate={filters.startDate}
                      endDate={filters.endDate}
                      onDateChange={(start, end) => {
                        handleFilterChange('startDate', start || '');
                        handleFilterChange('endDate', end || '');
                      }}
                      compact={true}
                      showPresets={true}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Name
                    </label>
                    <input
                      type="text"
                      placeholder="Search by account, customer, or supplier name..."
                      value={filters.accountName}
                      onChange={(e) => handleFilterChange('accountName', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleClearFilters}
                      className="btn btn-secondary w-full"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Account Info */}
          {selectedAccount && (
            <div className="card mb-6 print-only">
              {/* Print header */}
              <div className="print-header hidden print:block mb-6">
                <div className="text-center mb-6 border-b pb-4">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{companyInfo?.name || 'Company Name'}</h1>
                  {companyInfo?.address && <p className="text-sm text-gray-600">{companyInfo.address}</p>}
                  {companyInfo?.phone && <p className="text-sm text-gray-600">{companyInfo.phone}</p>}
                  {companyInfo?.email && <p className="text-sm text-gray-600">{companyInfo.email}</p>}
                </div>
                <h2 className="text-2xl font-bold text-center text-gray-800">Account Ledger</h2>
                <div className="text-center mt-2">
                  <p className="font-semibold text-lg">{selectedAccount.accountCode} - {selectedAccount.accountName}</p>
                  {filters.startDate && filters.endDate && (
                    <p className="text-sm text-gray-600">
                      Period: {formatDate(filters.startDate)} to {formatDate(filters.endDate)}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">
                    Generated: {new Date().toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Regular account info (hidden in print) */}
              <div className="no-print">
                <div className="card-content">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-3">
                        <h2 className="text-xl font-bold text-gray-900">
                          {selectedAccount.accountCode} - {selectedAccount.accountName}
                        </h2>
                        <AccountTypeBadge type={selectedAccount.accountType} />
                      </div>
                      {selectedAccount.description && (
                        <p className="text-sm text-gray-600 mt-2">
                          {selectedAccount.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center space-x-4 text-sm">
                        <span className="text-gray-600">
                          Normal Balance: <span className="font-medium capitalize">{selectedAccount.normalBalance}</span>
                        </span>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-600">
                          Category: <span className="font-medium capitalize">{selectedAccount.accountCategory.replace('_', ' ')}</span>
                        </span>
                        {selectedAccount.openingBalance !== undefined && (
                          <>
                            <span className="text-gray-400">|</span>
                            <span className="text-gray-600">
                              Opening Balance: <span className={`font-medium ${(selectedAccount.openingBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(Math.abs(selectedAccount.openingBalance || 0))}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Current Balance</div>
                      <div className={`text-2xl font-bold ${selectedAccount.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {formatCurrency(Math.abs(selectedAccount.currentBalance))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          {summary.totalEntries > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div className="card">
                <div className="card-content">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Opening Balance</p>
                      <p className={`text-xl font-bold ${(summary.openingBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {formatCurrency(Math.abs(summary.openingBalance || 0))}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-gray-500" />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-content">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Debits</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(summary.totalDebits)}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-content">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Credits</p>
                      <p className="text-xl font-bold text-red-600">
                        {formatCurrency(summary.totalCredits)}
                      </p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-500" />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-content">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Closing Balance</p>
                      <p className={`text-xl font-bold ${summary.closingBalance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {formatCurrency(Math.abs(summary.closingBalance))}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-500" />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-content">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Entries</p>
                      <p className="text-xl font-bold text-gray-900">
                        {summary.totalEntries}
                      </p>
                    </div>
                    <FileText className="h-8 w-8 text-purple-500" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ledger Table */}
          <div className="card account-ledger-print">
            <div className="card-header">
              <h3 className="text-lg font-semibold flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Ledger Entries
                {ledgerEntries.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({ledgerEntries.length} entries)
                  </span>
                )}
              </h3>
            </div>
            <div className="card-content p-0">
              {ledgerLoading ? (
                <div className="flex justify-center items-center py-12">
                  <LoadingSpinner />
                </div>
              ) : ledgerEntries.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {selectedAccount
                      ? 'No transactions found for this account'
                      : 'Select an account to view ledger entries'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 account-ledger-table">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reference
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Debit
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Credit
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Balance
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Source
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {ledgerEntries.map((entry, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(entry.date)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div>{entry.description}</div>
                            {entry.customer && (
                              <div className="text-xs text-gray-500 mt-1">
                                Customer: {entry.customer}
                              </div>
                            )}
                            {entry.supplier && (
                              <div className="text-xs text-gray-500 mt-1">
                                Supplier: {entry.supplier}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {entry.reference || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600">
                            {entry.debitAmount > 0 ? formatCurrency(entry.debitAmount) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                            {entry.creditAmount > 0 ? formatCurrency(entry.creditAmount) : '-'}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${entry.balance >= 0 ? 'text-gray-900' : 'text-red-600'
                            }`}>
                            {formatCurrency(Math.abs(entry.balance))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              {entry.source}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountLedger;

