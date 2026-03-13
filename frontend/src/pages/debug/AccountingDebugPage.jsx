import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Download, RefreshCw } from 'lucide-react';
import { useGetDebugDashboardQuery, useGetLedgerIntegrityQuery, useGetChartOfAccountsDebugQuery, useGetAccountLedgerDebugQuery, useGetCustomerBalanceDebugQuery, useGetSupplierBalanceDebugQuery, useGetSalesOrderDebugQuery, useGetSaleTransactionDebugQuery, useGetPurchaseOrderDebugQuery, useGetPurchaseTransactionDebugQuery, useGetCashReceiptDebugQuery, useGetCashPaymentDebugQuery, useGetBankReceiptDebugQuery, useGetBankPaymentDebugQuery, useGetBalanceSheetDebugQuery, useGetPostingLogQuery, useGetAuditResultsQuery, useGetDebitCreditValidationQuery } from '../../store/services/accountingDebugApi';
import { LoadingSpinner } from '../../components/LoadingSpinner';

const formatNum = (n) => {
  if (n == null || n === undefined || n === '') return '0.00';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  return isNaN(num) ? '0.00' : num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const StatusBadge = ({ ok }) => (
  <span className={`px-2 py-1 rounded text-xs font-medium ${ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
    {ok ? '✓' : '✗'}
  </span>
);

const filterRows = (rows, search) => {
  if (!rows || !Array.isArray(rows)) return [];
  if (!search) return rows;
  const s = search.toLowerCase();
  return rows.filter(row => {
    const str = JSON.stringify(row).toLowerCase();
    return str.includes(s);
  });
};

export default function AccountingDebugPage() {
  const { section } = useParams();
  const effectiveSection = section || 'dashboard';
  const [search, setSearch] = useState('');

  // All queries with skip logic
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError, refetch: refetchDashboard } = useGetDebugDashboardQuery(undefined, { skip: effectiveSection !== 'dashboard', refetchOnMountOrArgChange: true });
  const { data: integrityData, isLoading: integrityLoading, error: integrityError, refetch: refetchIntegrity } = useGetLedgerIntegrityQuery(undefined, { skip: effectiveSection !== 'ledger-integrity', refetchOnMountOrArgChange: true });
  const { data: coaData, isLoading: coaLoading, error: coaError, refetch: refetchCoa } = useGetChartOfAccountsDebugQuery(undefined, { skip: effectiveSection !== 'chart-of-accounts', refetchOnMountOrArgChange: true });
  const { data: ledgerData, isLoading: ledgerLoading, error: ledgerError, refetch: refetchLedger } = useGetAccountLedgerDebugQuery(undefined, { skip: effectiveSection !== 'account-ledger', refetchOnMountOrArgChange: true });
  const { data: customerData, isLoading: customerLoading, error: customerError, refetch: refetchCustomer } = useGetCustomerBalanceDebugQuery(undefined, { skip: effectiveSection !== 'customer-balance', refetchOnMountOrArgChange: true });
  const { data: supplierData, isLoading: supplierLoading, error: supplierError, refetch: refetchSupplier } = useGetSupplierBalanceDebugQuery(undefined, { skip: effectiveSection !== 'supplier-balance', refetchOnMountOrArgChange: true });
  const { data: salesOrderData, isLoading: salesOrderLoading, error: salesOrderError, refetch: refetchSalesOrder } = useGetSalesOrderDebugQuery(undefined, { skip: effectiveSection !== 'sales-order', refetchOnMountOrArgChange: true });
  const { data: saleTxnData, isLoading: saleTxnLoading, error: saleTxnError, refetch: refetchSaleTxn } = useGetSaleTransactionDebugQuery(undefined, { skip: effectiveSection !== 'sale-transaction', refetchOnMountOrArgChange: true });
  const { data: purchaseOrderData, isLoading: purchaseOrderLoading, error: purchaseOrderError, refetch: refetchPurchaseOrder } = useGetPurchaseOrderDebugQuery(undefined, { skip: effectiveSection !== 'purchase-order', refetchOnMountOrArgChange: true });
  const { data: purchaseTxnData, isLoading: purchaseTxnLoading, error: purchaseTxnError, refetch: refetchPurchaseTxn } = useGetPurchaseTransactionDebugQuery(undefined, { skip: effectiveSection !== 'purchase-transaction', refetchOnMountOrArgChange: true });
  const { data: cashReceiptData, isLoading: cashReceiptLoading, error: cashReceiptError, refetch: refetchCashReceipt } = useGetCashReceiptDebugQuery(undefined, { skip: effectiveSection !== 'cash-receipt', refetchOnMountOrArgChange: true });
  const { data: cashPaymentData, isLoading: cashPaymentLoading, error: cashPaymentError, refetch: refetchCashPayment } = useGetCashPaymentDebugQuery(undefined, { skip: effectiveSection !== 'cash-payment', refetchOnMountOrArgChange: true });
  const { data: bankReceiptData, isLoading: bankReceiptLoading, error: bankReceiptError, refetch: refetchBankReceipt } = useGetBankReceiptDebugQuery(undefined, { skip: effectiveSection !== 'bank-receipt', refetchOnMountOrArgChange: true });
  const { data: bankPaymentData, isLoading: bankPaymentLoading, error: bankPaymentError, refetch: refetchBankPayment } = useGetBankPaymentDebugQuery(undefined, { skip: effectiveSection !== 'bank-payment', refetchOnMountOrArgChange: true });
  const { data: balanceSheetData, isLoading: balanceSheetLoading, error: balanceSheetError, refetch: refetchBalanceSheet } = useGetBalanceSheetDebugQuery(undefined, { skip: effectiveSection !== 'balance-sheet', refetchOnMountOrArgChange: true });
  const { data: postingLogData, isLoading: postingLogLoading, error: postingLogError, refetch: refetchPostingLog } = useGetPostingLogQuery(undefined, { skip: effectiveSection !== 'posting-log', refetchOnMountOrArgChange: true });
  const { data: auditData, isLoading: auditLoading, error: auditError, refetch: refetchAudit } = useGetAuditResultsQuery(undefined, { skip: effectiveSection !== 'audit-results', refetchOnMountOrArgChange: true });
  const { data: debitCreditData, isLoading: debitCreditLoading, error: debitCreditError, refetch: refetchDebitCredit } = useGetDebitCreditValidationQuery(undefined, { skip: effectiveSection !== 'debit-credit-validation', refetchOnMountOrArgChange: true });

  const loading = dashboardLoading || integrityLoading || coaLoading || ledgerLoading || customerLoading || supplierLoading || salesOrderLoading || saleTxnLoading || purchaseOrderLoading || purchaseTxnLoading || cashReceiptLoading || cashPaymentLoading || bankReceiptLoading || bankPaymentLoading || balanceSheetLoading || postingLogLoading || auditLoading || debitCreditLoading;

  const refetchAll = () => {
    refetchDashboard();
    refetchIntegrity();
    refetchCoa();
    refetchLedger();
    refetchCustomer();
    refetchSupplier();
    refetchSalesOrder();
    refetchSaleTxn();
    refetchPurchaseOrder();
    refetchPurchaseTxn();
    refetchCashReceipt();
    refetchCashPayment();
    refetchBankReceipt();
    refetchBankPayment();
    refetchBalanceSheet();
    refetchPostingLog();
    refetchAudit();
    refetchDebitCredit();
  };

  const exportJson = () => {
    let obj = {};
    if (effectiveSection === 'dashboard' && dashboardData?.data?.data) obj = dashboardData.data.data;
    if (effectiveSection === 'ledger-integrity' && integrityData?.data?.data) obj = integrityData.data.data;
    if (effectiveSection === 'chart-of-accounts' && coaData?.data?.data) obj = coaData.data.data;
    if (effectiveSection === 'account-ledger' && ledgerData?.data?.data) obj = ledgerData.data.data;
    if (effectiveSection === 'customer-balance' && customerData?.data?.data) obj = customerData.data.data;
    if (effectiveSection === 'supplier-balance' && supplierData?.data?.data) obj = supplierData.data.data;
    if (effectiveSection === 'sales-order' && salesOrderData?.data?.data) obj = salesOrderData.data.data;
    if (effectiveSection === 'sale-transaction' && saleTxnData?.data?.data) obj = saleTxnData.data.data;
    if (effectiveSection === 'purchase-order' && purchaseOrderData?.data?.data) obj = purchaseOrderData.data.data;
    if (effectiveSection === 'purchase-transaction' && purchaseTxnData?.data?.data) obj = purchaseTxnData.data.data;
    if (effectiveSection === 'cash-receipt' && cashReceiptData?.data?.data) obj = cashReceiptData.data.data;
    if (effectiveSection === 'cash-payment' && cashPaymentData?.data?.data) obj = cashPaymentData.data.data;
    if (effectiveSection === 'bank-receipt' && bankReceiptData?.data?.data) obj = bankReceiptData.data.data;
    if (effectiveSection === 'bank-payment' && bankPaymentData?.data?.data) obj = bankPaymentData.data.data;
    if (effectiveSection === 'balance-sheet' && balanceSheetData?.data?.data) obj = balanceSheetData.data.data;
    if (effectiveSection === 'posting-log' && postingLogData?.data?.data) obj = postingLogData.data.data;
    if (effectiveSection === 'audit-results' && auditData?.data?.data) obj = auditData.data.data;
    if (effectiveSection === 'debit-credit-validation' && debitCreditData?.data?.data) obj = debitCreditData.data.data;
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `debug-${effectiveSection}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Accounting Debug Mode</h1>
        <div className="flex gap-2">
          <button onClick={refetchAll} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh All
          </button>
          <button onClick={exportJson} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export JSON
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {loading && <LoadingSpinner />}

      {/* Dashboard Section */}
      {!loading && effectiveSection === 'dashboard' && (() => {
        const dashboard = dashboardData?.data?.data || dashboardData?.data || dashboardData;
        if (dashboardError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(dashboardError)}</div>;
        }
        if (!dashboard) return <div className="text-gray-500">No dashboard data available.</div>;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Total Ledger Debit', value: formatNum(dashboard.totalLedgerDebit), ok: true },
              { label: 'Total Ledger Credit', value: formatNum(dashboard.totalLedgerCredit), ok: true },
              { label: 'Debit = Credit', value: dashboard.debitEqualsCredit ? 'Yes' : 'No', ok: dashboard.debitEqualsCredit },
              { label: 'Accounts Receivable', value: formatNum(dashboard.accountsReceivableTotal) },
              { label: 'Accounts Payable', value: formatNum(dashboard.accountsPayableTotal) },
              { label: 'Cash Balance', value: formatNum(dashboard.cashBalance) },
              { label: 'Bank Balance', value: formatNum(dashboard.bankBalance) },
              { label: 'Revenue Total', value: formatNum(dashboard.revenueTotal) },
              { label: 'Expense Total', value: formatNum(dashboard.expenseTotal) },
              { label: 'Equity Total', value: formatNum(dashboard.equityTotal) },
              { label: 'Asset Total', value: formatNum(dashboard.assetTotal) },
              { label: 'Liability Total', value: formatNum(dashboard.liabilityTotal) },
            ].map(({ label, value, ok }) => (
              <div key={label} className={`rounded-lg border p-4 ${ok === false ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}`}>
                <div className="text-sm text-gray-500">{label}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{value}</span>
                  {typeof ok === 'boolean' && <StatusBadge ok={ok} />}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Ledger Integrity Section */}
      {!loading && effectiveSection === 'ledger-integrity' && (() => {
        const integrity = integrityData?.data?.data || integrityData?.data || integrityData;
        if (integrityError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(integrityError)}</div>;
        }
        if (!integrity) return <div className="text-gray-500">No integrity data available.</div>;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <StatusBadge ok={integrity.valid} />
              <span>Total Debit: {formatNum(integrity.totalDebit)} | Total Credit: {formatNum(integrity.totalCredit)}</span>
            </div>
            {integrity.issues?.length > 0 ? (
              <table className="min-w-full border border-gray-200 rounded overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-left px-4 py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filterRows(integrity.issues, search).map((issue, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-medium text-red-700">{issue.type}</td>
                      <td className="px-4 py-2 text-sm">{JSON.stringify(issue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-green-700">No integrity issues found.</p>
            )}
          </div>
        );
      })()}

      {/* Chart of Accounts Section */}
      {!loading && effectiveSection === 'chart-of-accounts' && (() => {
        const coa = coaData?.data?.data || coaData?.data || coaData;
        if (coaError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(coaError)}</div>;
        }
        if (!coa || !Array.isArray(coa)) return <div className="text-gray-500">No chart of accounts data available.</div>;
        return (
          <table className="min-w-full border border-gray-200 rounded overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Code</th>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-right px-4 py-2">Ledger Debit</th>
                <th className="text-right px-4 py-2">Ledger Credit</th>
                <th className="text-right px-4 py-2">Net Balance</th>
                <th className="text-right px-4 py-2">Stored</th>
                <th className="text-right px-4 py-2">Difference</th>
                <th className="text-center px-4 py-2">Valid</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(coa, search).map((row, i) => (
                <tr key={i} className={`border-t border-gray-100 ${row.valid ? '' : 'bg-red-50'}`}>
                  <td className="px-4 py-2 font-mono">{row.accountCode}</td>
                  <td className="px-4 py-2">{row.accountName}</td>
                  <td className="px-4 py-2 text-right">{formatNum(row.ledgerDebitSum)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(row.ledgerCreditSum)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(row.netBalance)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(row.storedBalance)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(row.difference)}</td>
                  <td className="px-4 py-2 text-center"><StatusBadge ok={row.valid} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      {/* Account Ledger Section */}
      {!loading && effectiveSection === 'account-ledger' && (() => {
        const ledger = ledgerData?.data?.data || ledgerData?.data || ledgerData;
        if (ledgerError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(ledgerError)}</div>;
        }
        if (!ledger) return <div className="text-gray-500">No ledger data available.</div>;
        return (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">Total Debit: {formatNum(ledger.totalDebit)} | Total Credit: {formatNum(ledger.totalCredit)}</div>
            {ledger.duplicatePostings?.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">Duplicate Postings ({ledger.duplicatePostings.length})</h3>
                <pre className="text-xs overflow-auto">{JSON.stringify(ledger.duplicatePostings, null, 2)}</pre>
              </div>
            )}
            {ledger.missingReferences?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <h3 className="font-semibold text-red-800 mb-2">Missing References ({ledger.missingReferences.length})</h3>
                <pre className="text-xs overflow-auto">{JSON.stringify(ledger.missingReferences, null, 2)}</pre>
              </div>
            )}
            {ledger.entries?.length > 0 && (
              <table className="min-w-full border border-gray-200 rounded overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2">Date</th>
                    <th className="text-left px-4 py-2">Account</th>
                    <th className="text-right px-4 py-2">Debit</th>
                    <th className="text-right px-4 py-2">Credit</th>
                    <th className="text-left px-4 py-2">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {filterRows(ledger.entries, search).map((entry, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-4 py-2">{entry.date || entry.transactionDate}</td>
                      <td className="px-4 py-2 font-mono">{entry.accountCode}</td>
                      <td className="px-4 py-2 text-right">{formatNum(entry.debitAmount)}</td>
                      <td className="px-4 py-2 text-right">{formatNum(entry.creditAmount)}</td>
                      <td className="px-4 py-2">{entry.referenceId || entry.reference_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })()}

      {/* Customer Balance Section */}
      {!loading && effectiveSection === 'customer-balance' && (() => {
        const customers = customerData?.data?.data || customerData?.data || customerData;
        if (customerError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(customerError)}</div>;
        }
        if (!customers || !Array.isArray(customers)) return <div className="text-gray-500">No customer balance data available.</div>;
        return (
          <table className="min-w-full border border-gray-200 rounded overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Customer</th>
                <th className="text-right px-4 py-2">Ledger Balance</th>
                <th className="text-right px-4 py-2">Stored Balance</th>
                <th className="text-right px-4 py-2">Difference</th>
                <th className="text-center px-4 py-2">Valid</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(customers, search).map((row, i) => (
                <tr key={i} className={`border-t border-gray-100 ${row.valid ? '' : 'bg-red-50'}`}>
                  <td className="px-4 py-2">{row.customerName || row.name}</td>
                  <td className="px-4 py-2 text-right">{formatNum(row.ledgerBalance)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(row.storedBalance)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(row.difference)}</td>
                  <td className="px-4 py-2 text-center"><StatusBadge ok={row.valid} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      {/* Supplier Balance Section */}
      {!loading && effectiveSection === 'supplier-balance' && (() => {
        const suppliers = supplierData?.data?.data || supplierData?.data || supplierData;
        if (supplierError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(supplierError)}</div>;
        }
        if (!suppliers || !Array.isArray(suppliers)) return <div className="text-gray-500">No supplier balance data available.</div>;
        return (
          <table className="min-w-full border border-gray-200 rounded overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Supplier</th>
                <th className="text-right px-4 py-2">Ledger Balance</th>
                <th className="text-right px-4 py-2">Stored Balance</th>
                <th className="text-right px-4 py-2">Difference</th>
                <th className="text-center px-4 py-2">Valid</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(suppliers, search).map((row, i) => (
                <tr key={i} className={`border-t border-gray-100 ${row.valid ? '' : 'bg-red-50'}`}>
                  <td className="px-4 py-2">{row.supplierName || row.name}</td>
                  <td className="px-4 py-2 text-right">{formatNum(row.ledgerBalance)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(row.storedBalance)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(row.difference)}</td>
                  <td className="px-4 py-2 text-center"><StatusBadge ok={row.valid} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      {/* Sales Order Section */}
      {!loading && effectiveSection === 'sales-order' && (() => {
        const sales = salesOrderData?.data?.data || salesOrderData?.data || salesOrderData;
        if (salesOrderError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(salesOrderError)}</div>;
        }
        if (!sales || !Array.isArray(sales)) return <div className="text-gray-500">No sales order data available.</div>;
        return (
          <table className="min-w-full border border-gray-200 rounded overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Order ID</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Amount</th>
                <th className="text-center px-4 py-2">Posted</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(sales, search).map((row, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2">{row.orderId || row.id}</td>
                  <td className="px-4 py-2">{row.status}</td>
                  <td className="px-4 py-2 text-right">{formatNum(row.totalAmount || row.amount)}</td>
                  <td className="px-4 py-2 text-center"><StatusBadge ok={row.posted} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      {/* Sale Transaction Section */}
      {!loading && effectiveSection === 'sale-transaction' && (() => {
        const saleTxn = saleTxnData?.data?.data || saleTxnData?.data || saleTxnData;
        const entries = saleTxn?.entries || (Array.isArray(saleTxn) ? saleTxn : []);
        if (saleTxnError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(saleTxnError)}</div>;
        }
        if (!entries || entries.length === 0) return <div className="text-gray-500">No sale transaction data available.</div>;
        return (
          <table className="min-w-full border border-gray-200 rounded overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Account</th>
                <th className="text-right px-4 py-2">Debit</th>
                <th className="text-right px-4 py-2">Credit</th>
                <th className="text-left px-4 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(entries, search).map((entry, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2">{entry.date || entry.transactionDate}</td>
                  <td className="px-4 py-2 font-mono">{entry.accountCode}</td>
                  <td className="px-4 py-2 text-right">{formatNum(entry.debitAmount)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(entry.creditAmount)}</td>
                  <td className="px-4 py-2">{entry.referenceId || entry.reference_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      {/* Purchase Order Section */}
      {!loading && effectiveSection === 'purchase-order' && (() => {
        const purchases = purchaseOrderData?.data?.data || purchaseOrderData?.data || purchaseOrderData;
        if (purchaseOrderError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(purchaseOrderError)}</div>;
        }
        if (!purchases || !Array.isArray(purchases)) return <div className="text-gray-500">No purchase order data available.</div>;
        return (
          <table className="min-w-full border border-gray-200 rounded overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Order ID</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Amount</th>
                <th className="text-center px-4 py-2">Posted</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(purchases, search).map((row, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2">{row.orderId || row.id}</td>
                  <td className="px-4 py-2">{row.status}</td>
                  <td className="px-4 py-2 text-right">{formatNum(row.totalAmount || row.amount)}</td>
                  <td className="px-4 py-2 text-center"><StatusBadge ok={row.posted} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      {/* Purchase Transaction Section */}
      {!loading && effectiveSection === 'purchase-transaction' && (() => {
        const purchaseTxn = purchaseTxnData?.data?.data || purchaseTxnData?.data || purchaseTxnData;
        const entries = purchaseTxn?.entries || (Array.isArray(purchaseTxn) ? purchaseTxn : []);
        if (purchaseTxnError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(purchaseTxnError)}</div>;
        }
        if (!entries || entries.length === 0) return <div className="text-gray-500">No purchase transaction data available.</div>;
        return (
          <table className="min-w-full border border-gray-200 rounded overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Account</th>
                <th className="text-right px-4 py-2">Debit</th>
                <th className="text-right px-4 py-2">Credit</th>
                <th className="text-left px-4 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(entries, search).map((entry, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2">{entry.date || entry.transactionDate}</td>
                  <td className="px-4 py-2 font-mono">{entry.accountCode}</td>
                  <td className="px-4 py-2 text-right">{formatNum(entry.debitAmount)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(entry.creditAmount)}</td>
                  <td className="px-4 py-2">{entry.referenceId || entry.reference_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      {/* Cash Receipt Section */}
      {!loading && effectiveSection === 'cash-receipt' && (() => {
        const cashReceipt = cashReceiptData?.data?.data || cashReceiptData?.data || cashReceiptData;
        const entries = cashReceipt?.entries || (Array.isArray(cashReceipt) ? cashReceipt : []);
        if (cashReceiptError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(cashReceiptError)}</div>;
        }
        if (!entries || entries.length === 0) return <div className="text-gray-500">No cash receipt data available.</div>;
        return (
          <table className="min-w-full border border-gray-200 rounded overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Account</th>
                <th className="text-right px-4 py-2">Debit</th>
                <th className="text-right px-4 py-2">Credit</th>
                <th className="text-left px-4 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(entries, search).map((entry, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2">{entry.date || entry.transactionDate}</td>
                  <td className="px-4 py-2 font-mono">{entry.accountCode}</td>
                  <td className="px-4 py-2 text-right">{formatNum(entry.debitAmount)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(entry.creditAmount)}</td>
                  <td className="px-4 py-2">{entry.referenceId || entry.reference_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      {/* Cash Payment Section */}
      {!loading && effectiveSection === 'cash-payment' && (() => {
        const cashPayment = cashPaymentData?.data?.data || cashPaymentData?.data || cashPaymentData;
        const entries = cashPayment?.entries || (Array.isArray(cashPayment) ? cashPayment : []);
        if (cashPaymentError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(cashPaymentError)}</div>;
        }
        if (!entries || entries.length === 0) return <div className="text-gray-500">No cash payment data available.</div>;
        return (
          <table className="min-w-full border border-gray-200 rounded overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Account</th>
                <th className="text-right px-4 py-2">Debit</th>
                <th className="text-right px-4 py-2">Credit</th>
                <th className="text-left px-4 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(entries, search).map((entry, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2">{entry.date || entry.transactionDate}</td>
                  <td className="px-4 py-2 font-mono">{entry.accountCode}</td>
                  <td className="px-4 py-2 text-right">{formatNum(entry.debitAmount)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(entry.creditAmount)}</td>
                  <td className="px-4 py-2">{entry.referenceId || entry.reference_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      {/* Bank Receipt Section */}
      {!loading && effectiveSection === 'bank-receipt' && (() => {
        const bankReceipt = bankReceiptData?.data?.data || bankReceiptData?.data || bankReceiptData;
        const entries = bankReceipt?.entries || (Array.isArray(bankReceipt) ? bankReceipt : []);
        if (bankReceiptError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(bankReceiptError)}</div>;
        }
        if (!entries || entries.length === 0) return <div className="text-gray-500">No bank receipt data available.</div>;
        return (
          <table className="min-w-full border border-gray-200 rounded overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Account</th>
                <th className="text-right px-4 py-2">Debit</th>
                <th className="text-right px-4 py-2">Credit</th>
                <th className="text-left px-4 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(entries, search).map((entry, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2">{entry.date || entry.transactionDate}</td>
                  <td className="px-4 py-2 font-mono">{entry.accountCode}</td>
                  <td className="px-4 py-2 text-right">{formatNum(entry.debitAmount)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(entry.creditAmount)}</td>
                  <td className="px-4 py-2">{entry.referenceId || entry.reference_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      {/* Bank Payment Section */}
      {!loading && effectiveSection === 'bank-payment' && (() => {
        const bankPayment = bankPaymentData?.data?.data || bankPaymentData?.data || bankPaymentData;
        const entries = bankPayment?.entries || (Array.isArray(bankPayment) ? bankPayment : []);
        if (bankPaymentError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(bankPaymentError)}</div>;
        }
        if (!entries || entries.length === 0) return <div className="text-gray-500">No bank payment data available.</div>;
        return (
          <table className="min-w-full border border-gray-200 rounded overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Account</th>
                <th className="text-right px-4 py-2">Debit</th>
                <th className="text-right px-4 py-2">Credit</th>
                <th className="text-left px-4 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(entries, search).map((entry, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2">{entry.date || entry.transactionDate}</td>
                  <td className="px-4 py-2 font-mono">{entry.accountCode}</td>
                  <td className="px-4 py-2 text-right">{formatNum(entry.debitAmount)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(entry.creditAmount)}</td>
                  <td className="px-4 py-2">{entry.referenceId || entry.reference_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      {/* Balance Sheet Section */}
      {!loading && effectiveSection === 'balance-sheet' && (() => {
        const balanceSheet = balanceSheetData?.data?.data || balanceSheetData?.data || balanceSheetData;
        const byType = balanceSheet?.byType || (Array.isArray(balanceSheet) ? balanceSheet : []);
        if (balanceSheetError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(balanceSheetError)}</div>;
        }
        if (!byType || byType.length === 0) return <div className="text-gray-500">No balance sheet data available.</div>;
        return (
          <div className="space-y-4">
            {Object.entries(byType).map(([type, accounts]) => (
              <div key={type} className="border border-gray-200 rounded p-4">
                <h3 className="font-semibold mb-2">{type}</h3>
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2">Account</th>
                      <th className="text-right px-4 py-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(accounts) && accounts.map((acc, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-4 py-2">{acc.accountName || acc.name}</td>
                        <td className="px-4 py-2 text-right">{formatNum(acc.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Posting Log Section */}
      {!loading && effectiveSection === 'posting-log' && (() => {
        const postingLog = postingLogData?.data?.data || postingLogData?.data || postingLogData;
        const entries = postingLog?.entries || (Array.isArray(postingLog) ? postingLog : []);
        if (postingLogError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(postingLogError)}</div>;
        }
        if (!entries || entries.length === 0) return <div className="text-gray-500">No posting log data available.</div>;
        return (
          <table className="min-w-full border border-gray-200 rounded overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Timestamp</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Reference</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(entries, search).map((entry, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2">{entry.timestamp || entry.createdAt}</td>
                  <td className="px-4 py-2">{entry.transactionType || entry.type}</td>
                  <td className="px-4 py-2">{entry.referenceId || entry.reference_id}</td>
                  <td className="px-4 py-2"><StatusBadge ok={entry.status === 'posted' || entry.posted} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      {/* Audit Results Section */}
      {!loading && effectiveSection === 'audit-results' && (() => {
        const audit = auditData?.data?.data || auditData?.data || auditData;
        if (auditError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(auditError)}</div>;
        }
        if (!audit) return <div className="text-gray-500">No audit results available.</div>;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <StatusBadge ok={audit.valid} />
              <span>Total Mismatches: {audit.mismatches?.length || 0}</span>
            </div>
            {audit.mismatches?.length > 0 && (
              <table className="min-w-full border border-gray-200 rounded overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2">Account</th>
                    <th className="text-right px-4 py-2">Ledger Balance</th>
                    <th className="text-right px-4 py-2">Stored Balance</th>
                    <th className="text-right px-4 py-2">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {filterRows(audit.mismatches, search).map((mismatch, i) => (
                    <tr key={i} className="border-t border-gray-100 bg-red-50">
                      <td className="px-4 py-2">{mismatch.accountCode || mismatch.accountName}</td>
                      <td className="px-4 py-2 text-right">{formatNum(mismatch.ledgerBalance)}</td>
                      <td className="px-4 py-2 text-right">{formatNum(mismatch.storedBalance)}</td>
                      <td className="px-4 py-2 text-right">{formatNum(mismatch.difference)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })()}

      {/* Debit Credit Validation Section */}
      {!loading && effectiveSection === 'debit-credit-validation' && (() => {
        const validation = debitCreditData?.data?.data || debitCreditData?.data || debitCreditData;
        if (debitCreditError) {
          return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">API Error: {JSON.stringify(debitCreditError)}</div>;
        }
        if (!validation) return <div className="text-gray-500">No validation data available.</div>;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <StatusBadge ok={validation.valid} />
              <span>Total Debit: {formatNum(validation.totalDebit)} | Total Credit: {formatNum(validation.totalCredit)}</span>
            </div>
            {validation.errors?.length > 0 && (
              <table className="min-w-full border border-gray-200 rounded overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2">Transaction</th>
                    <th className="text-right px-4 py-2">Debit</th>
                    <th className="text-right px-4 py-2">Credit</th>
                    <th className="text-left px-4 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {filterRows(validation.errors, search).map((error, i) => (
                    <tr key={i} className="border-t border-gray-100 bg-red-50">
                      <td className="px-4 py-2">{error.referenceId || error.transactionId}</td>
                      <td className="px-4 py-2 text-right">{formatNum(error.debitAmount)}</td>
                      <td className="px-4 py-2 text-right">{formatNum(error.creditAmount)}</td>
                      <td className="px-4 py-2">{error.message || error.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })()}
    </div>
  );
}
