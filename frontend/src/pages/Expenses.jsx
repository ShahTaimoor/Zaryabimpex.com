import React, { useMemo, useState } from 'react';
import {
  Plus,
  Wallet,
  TrendingUp,
  Calendar,
  ClipboardList,
  RefreshCw,
  ArrowLeftRight,
  Eye,
  Printer,
  Pencil,
  Trash2
} from 'lucide-react';
import { useGetAccountsQuery } from '../store/services/chartOfAccountsApi';
import { useGetBanksQuery } from '../store/services/banksApi';
import {
  useGetCashPaymentsQuery,
  useCreateCashPaymentMutation,
  useUpdateCashPaymentMutation,
  useDeleteCashPaymentMutation,
} from '../store/services/cashPaymentsApi';
import {
  useGetBankPaymentsQuery,
  useCreateBankPaymentMutation,
  useUpdateBankPaymentMutation,
  useDeleteBankPaymentMutation,
} from '../store/services/bankPaymentsApi';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { formatCurrency, formatDate } from '../utils/formatters';
import RecurringExpensesPanel from '../components/RecurringExpensesPanel';

// Helper function to get local date in YYYY-MM-DD format (avoids timezone issues with toISOString)
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const today = getLocalDateString();

const defaultFormState = {
  date: today,
  expenseAccount: '',
  amount: '',
  notes: '',
  bank: '',
  particular: ''
};

const Expenses = () => {
  const [formData, setFormData] = useState(defaultFormState);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [editingExpense, setEditingExpense] = useState(null);

  const { data: expenseAccountsResponse, isLoading: expenseAccountsLoading } = useGetAccountsQuery({
    accountType: 'expense',
    isActive: 'true',
  });
  const expenseAccounts = useMemo(() => {
    // transformResponse in chartOfAccountsApi already returns an array
    if (Array.isArray(expenseAccountsResponse)) return expenseAccountsResponse;
    // Fallback in case transformResponse doesn't work
    if (Array.isArray(expenseAccountsResponse?.data)) return expenseAccountsResponse.data;
    if (Array.isArray(expenseAccountsResponse?.data?.accounts)) return expenseAccountsResponse.data.accounts;
    if (Array.isArray(expenseAccountsResponse?.accounts)) return expenseAccountsResponse.accounts;
    return [];
  }, [expenseAccountsResponse]);

  const { data: banksResponse, isLoading: banksLoading } = useGetBanksQuery({ isActive: true });
  const banks = useMemo(
    () => banksResponse?.data?.banks || banksResponse?.banks || banksResponse?.data || [],
    [banksResponse]
  );

  const { data: cashPaymentsResponse, isFetching: cashExpensesLoading } = useGetCashPaymentsQuery(
    { limit: 20 }
  );
  const cashPaymentsData = useMemo(() => {
    const items = cashPaymentsResponse?.data?.cashPayments || cashPaymentsResponse?.cashPayments || cashPaymentsResponse?.data?.data?.cashPayments || [];
    return items.filter((payment) => !payment?.supplier && !payment?.customer);
  }, [cashPaymentsResponse]);

  const { data: bankPaymentsResponse, isFetching: bankExpensesLoading } = useGetBankPaymentsQuery(
    { limit: 20 }
  );
  const bankPaymentsData = useMemo(() => {
    const items = bankPaymentsResponse?.data?.bankPayments || bankPaymentsResponse?.bankPayments || bankPaymentsResponse?.data?.data?.bankPayments || [];
    return items.filter((payment) => !payment?.supplier && !payment?.customer);
  }, [bankPaymentsResponse]);

  const combinedRecentExpenses = useMemo(() => {
    const apiResults = [
      ...(cashPaymentsData || []).map((item) => ({ ...item, source: 'cash' })),
      ...(bankPaymentsData || []).map((item) => ({ ...item, source: 'bank' })),
      ...recentExpenses
    ];

    return apiResults
      .filter((item, index, self) => item?._id && index === self.findIndex((s) => s._id === item._id))
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
      .slice(0, 25);
  }, [cashPaymentsData, bankPaymentsData, recentExpenses]);

  const valueToDisplayString = (value) => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return `${value}`;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    if (Array.isArray(value)) {
      const first = value.find((item) => item != null);
      return valueToDisplayString(first);
    }

    if (typeof value === 'object') {
      const candidateFields = [
        'label',
        'name',
        'accountName',
        'bankName',
        'displayName',
        'companyName',
        'businessName',
        'type',
        'title',
        'code',
        'id',
        '_id',
      ];

      for (const field of candidateFields) {
        if (field in value) {
          const result = valueToDisplayString(value[field]);
          if (result) return result;
        }
      }
    }

    return '';
  };

  const resolvePaymentMethodLabel = (expense) => {
    if (!expense) return 'cash';
    const { source, bank } = expense;

    const sourceLabel = valueToDisplayString(source);
    if (sourceLabel) return sourceLabel;

    if (bank) {
      const bankLabel = valueToDisplayString(bank);
      if (bankLabel) return bankLabel;
      return 'bank';
    }

    return 'cash';
  };

  const [createCashPayment, { isLoading: creatingCashPayment }] = useCreateCashPaymentMutation();
  const [updateCashPayment, { isLoading: updatingCashPayment }] = useUpdateCashPaymentMutation();
  const [deleteCashPayment] = useDeleteCashPaymentMutation();
  const [createBankPayment, { isLoading: creatingBankPayment }] = useCreateBankPaymentMutation();
  const [updateBankPayment, { isLoading: updatingBankPayment }] = useUpdateBankPaymentMutation();
  const [deleteBankPayment] = useDeleteBankPaymentMutation();

  const handleCashExpenseSubmit = async (payload) => {
    try {
      let data;
      if (editingExpense?.source === 'cash') {
        data = await updateCashPayment({ id: editingExpense._id, ...payload }).unwrap();
      } else {
        data = await createCashPayment(payload).unwrap();
      }
      const payment = data?.data || data;
      if (payment) {
        const enhanced = { ...payment, source: 'cash' };
        setRecentExpenses((prev) => {
          const filtered = prev.filter((item) => item._id !== enhanced._id);
          return [enhanced, ...filtered].slice(0, 10);
        });
      }
      showSuccessToast(editingExpense ? 'Cash expense updated successfully' : 'Cash expense recorded successfully');
      resetForm();
    } catch (error) {
      showErrorToast(handleApiError(error));
    }
  };

  const handleBankExpenseSubmit = async (payload) => {
    try {
      let data;
      if (editingExpense?.source === 'bank') {
        data = await updateBankPayment({ id: editingExpense._id, ...payload }).unwrap();
      } else {
        data = await createBankPayment(payload).unwrap();
      }
      const payment = data?.data || data;
      if (payment) {
        const enhanced = { ...payment, source: 'bank' };
        setRecentExpenses((prev) => {
          const filtered = prev.filter((item) => item._id !== enhanced._id);
          return [enhanced, ...filtered].slice(0, 10);
        });
      }
      showSuccessToast(editingExpense ? 'Bank expense updated successfully' : 'Bank expense recorded successfully');
      resetForm();
    } catch (error) {
      showErrorToast(handleApiError(error));
    }
  };

  const selectedAccount = useMemo(
    () => expenseAccounts.find((account) => account._id === formData.expenseAccount),
    [expenseAccounts, formData.expenseAccount]
  );

  const handleExpenseAccountChange = (accountId) => {
    setFormData((prev) => ({
      ...prev,
      expenseAccount: accountId,
      particular: prev.particular || (() => {
        const account = expenseAccounts.find((acc) => acc._id === accountId);
        return account ? account.accountName : '';
      })()
    }));
  };

  const resetForm = () => {
    setFormData(defaultFormState);
    setPaymentMethod('cash');
    setEditingExpense(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formData.expenseAccount) {
      showErrorToast('Please choose an expense account');
      return;
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      showErrorToast('Amount must be greater than zero');
      return;
    }

    const basePayload = {
      date: formData.date,
      amount: parseFloat(formData.amount),
      particular: formData.particular?.trim() || selectedAccount?.accountName || 'Expense',
      expenseAccount: formData.expenseAccount,
      notes: formData.notes?.trim() || undefined
    };

    if (paymentMethod === 'bank') {
      if (!formData.bank) {
        showErrorToast('Please select a bank account for this expense');
        return;
      }

      handleBankExpenseSubmit({
        ...basePayload,
        bank: formData.bank
      });
    } else {
      handleCashExpenseSubmit(basePayload);
    }
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setPaymentMethod(expense.source === 'bank' ? 'bank' : 'cash');
    setFormData({
      date: expense.date ? expense.date.split('T')[0] : today,
      expenseAccount: expense.expenseAccount?._id || expense.expenseAccount || '',
      amount: expense.amount?.toString() || '',
      notes: expense.notes || '',
      bank: expense.bank?._id || expense.bank || '',
      particular: expense.particular || ''
    });
  };

  const handleDeleteExpense = async (expense) => {
    const confirmed = window.confirm('Are you sure you want to delete this expense entry?');
    if (!confirmed) return;

    try {
      if (expense.source === 'bank') {
        await deleteBankPayment(expense._id).unwrap();
      } else {
        await deleteCashPayment(expense._id).unwrap();
      }
      setRecentExpenses((prev) => prev.filter((item) => item._id !== expense._id));
      showSuccessToast('Expense deleted successfully');
      if (editingExpense?._id === expense._id) {
        resetForm();
      }
    } catch (error) {
      showErrorToast(handleApiError(error));
    }
  };

  const openExpenseDocument = (expense, { print = false } = {}) => {
    const accountLabel = expense.expenseAccount?.accountName
      ? `${expense.expenseAccount.accountName} (${expense.expenseAccount.accountCode || ''})`
      : 'Expense Account';
    const methodLabel = expense.source === 'bank' ? 'Bank' : 'Cash';
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const htmlContent = `
      <html>
        <head>
          <title>Expense Voucher</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
            h1 { font-size: 20px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            td { padding: 8px 12px; border: 1px solid #e5e7eb; vertical-align: top; font-size: 14px; }
            .label { font-weight: 600; background: #f3f4f6; width: 35%; }
            .footer { text-align: center; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <h1>Expense Voucher</h1>
          <table>
            <tr>
              <td class="label">Voucher ID</td>
              <td>${expense.voucherCode || expense._id}</td>
            </tr>
            <tr>
              <td class="label">Date</td>
              <td>${formatDate(expense.date || expense.createdAt)}</td>
            </tr>
            <tr>
              <td class="label">Payment Method</td>
              <td>${methodLabel}</td>
            </tr>
            <tr>
              <td class="label">Expense Account</td>
              <td>${accountLabel}</td>
            </tr>
            <tr>
              <td class="label">Amount</td>
              <td>${formatCurrency(expense.amount || 0)}</td>
            </tr>
            <tr>
              <td class="label">Description</td>
              <td>${expense.particular || '-'}</td>
            </tr>
            <tr>
              <td class="label">Notes</td>
              <td>${expense.notes || '-'}</td>
            </tr>
          </table>
          <div class="footer">Generated on ${formatDate(new Date().toISOString())}</div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    if (print) {
      printWindow.print();
      printWindow.close();
    }
  };

  const handleViewExpense = (expense) => {
    openExpenseDocument(expense, { print: false });
  };

  const handlePrintExpense = (expense) => {
    openExpenseDocument(expense, { print: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center space-x-2">
          <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
          <span>Record Expense</span>
        </h1>
        <div className="mt-1 lg:mt-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.45fr)] gap-3 lg:gap-6 lg:items-start lg:mt-1">
          <p className="text-sm sm:text-base text-gray-600 lg:mt-1">
            Log operating expenses directly from cash or bank while posting to the right expense account.
          </p>
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50 w-full">
            <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Payment Method</p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mt-1">
              {[
                { value: 'cash', label: 'Cash', helper: 'Use cash on hand' },
                { value: 'bank', label: 'Bank', helper: 'Use a bank account' }
              ].map((option) => {
                const isActive = paymentMethod === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(option.value);
                      if (option.value === 'cash') {
                        setFormData((prev) => ({ ...prev, bank: '' }));
                      }
                    }}
                    className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 text-left transition-all duration-200 ${
                      isActive
                        ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                        : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:bg-primary-50/40'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className={`h-4 w-4 rounded-full border flex-shrink-0 ${
                          isActive ? 'border-primary-500 bg-primary-500' : 'border-gray-300 bg-white'
                        }`}
                      />
                      <span className="text-xs sm:text-sm font-semibold">{option.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{option.helper}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="card relative">
        <div className="card-content pt-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="form-label flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <span>Expense Account</span>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn btn-outline btn-md flex items-center justify-center gap-2 text-xs sm:text-sm"
                  >
                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>Reset</span>
                  </button>
                </label>
                <select
                  className="input"
                  value={formData.expenseAccount}
                  onChange={(e) => handleExpenseAccountChange(e.target.value)}
                  required
                  disabled={expenseAccountsLoading}
                >
                  <option value="">Select expense account</option>
                  {expenseAccounts.map((account) => (
                    <option key={account._id} value={account._id}>
                      {account.accountName} ({account.accountCode})
                    </option>
                  ))}
                </select>
                {selectedAccount && (
                  <p className="text-xs text-gray-500 mt-1">
                    Selected account will be debited when this expense is posted.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Amount</label>
                  <div className="relative">
                    <TrendingUp className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input pl-9"
                      value={formData.amount}
                      onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      className="input pl-9"
                      value={formData.date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">Description (optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder={selectedAccount ? selectedAccount.accountName : 'e.g., Rent for November'}
                  value={formData.particular}
                  onChange={(e) => setFormData((prev) => ({ ...prev, particular: e.target.value }))}
                />
              </div>

              {paymentMethod === 'bank' && (
                <div>
                  <label className="form-label">Bank Account</label>
                  <select
                    className="input"
                    value={formData.bank}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bank: e.target.value }))}
                    required
                    disabled={banksLoading}
                  >
                    <option value="">Select bank account</option>
                    {banks.map((bank) => (
                      <option key={bank._id} value={bank._id}>
                        {bank.bankName} • {bank.accountNumber}
                        {bank.accountName ? ` (${bank.accountName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="form-label">Notes</label>
                <textarea
                  className="input"
                  rows={6}
                  placeholder="Optional internal notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="border rounded-lg bg-primary-50/40 p-4">
                <h3 className="text-sm font-semibold text-primary-700 mb-2">Posting Preview</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <span>Debit</span>
                    <span>{selectedAccount ? `${selectedAccount.accountName} (${selectedAccount.accountCode})` : 'Select expense account'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Credit</span>
                    <span>{paymentMethod === 'cash' ? 'Cash on Hand' : 'Bank Account'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Amount</span>
                    <span>
                      {formData.amount
                        ? formatCurrency(parseFloat(formData.amount) || 0)
                        : formatCurrency(0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
                  disabled={
                    creatingCashPayment ||
                    updatingCashPayment ||
                    creatingBankPayment ||
                    updatingBankPayment
                  }
                >
                  <Plus className="h-4 w-4" />
                  <span>{editingExpense ? 'Update Expense' : 'Save Expense'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <ArrowLeftRight className="h-5 w-5 text-primary-600" />
              <span>Recent Expense Entries</span>
            </h2>
            {(cashExpensesLoading || bankExpensesLoading) && (
              <span className="text-xs text-gray-500">Refreshing...</span>
            )}
          </div>
          <div className="card-content">
            {combinedRecentExpenses.length === 0 ? (
              <p className="text-sm text-gray-500">
                Expenses recorded here will appear in this list for quick reference.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Voucher</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Expense Account</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {combinedRecentExpenses.map((expense) => (
                      <tr key={expense._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {formatDate(expense.date || expense.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {expense.voucherCode || expense._id}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {expense.expenseAccount?.accountName
                            ? `${expense.expenseAccount.accountName} (${expense.expenseAccount.accountCode})`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {expense.particular || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                          {formatCurrency(expense.amount || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-center capitalize whitespace-nowrap">
                          {resolvePaymentMethodLabel(expense)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewExpense(expense)}
                              className="p-2 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
                              title="View Expense"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintExpense(expense)}
                              className="p-2 rounded-md text-green-600 hover:bg-green-50 transition-colors"
                              title="Print Expense"
                            >
                              <Printer className="h-4 w-4" />
                              <span className="sr-only">Print</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditExpense(expense)}
                              className="p-2 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit Expense"
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(expense)}
                              className="p-2 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete Expense"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <RecurringExpensesPanel
          expenseAccounts={expenseAccounts}
          onPaymentRecorded={(payload) => {
            if (payload?.payment) {
              setRecentExpenses((prev) => [{ ...payload.payment, source: payload.payment.bank ? 'bank' : 'cash' }, ...prev].slice(0, 25));
            }
          }}
        />
      </div>
    </div>
  );
};

export default Expenses;
