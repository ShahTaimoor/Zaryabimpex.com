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
  Trash2,
  Search,
  Building,
  User,
  Phone,
  Mail
} from 'lucide-react';
import { useDebouncedCustomerSearch } from '../hooks/useDebouncedCustomerSearch';
import { useDebouncedSupplierSearch } from '../hooks/useDebouncedSupplierSearch';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDate } from '../utils/formatters';
import RecurringExpensesPanel from '../components/RecurringExpensesPanel';
import { getLocalDateString } from '../utils/dateUtils';

const today = getLocalDateString();

const defaultFormState = {
  date: today,
  expenseAccount: '',
  amount: '',
  notes: '',
  bank: '',
  particular: '',
  supplier: '',
  customer: ''
};

const Expenses = () => {
  const [formData, setFormData] = useState(defaultFormState);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [editingExpense, setEditingExpense] = useState(null);
  const [partyType, setPartyType] = useState('supplier'); // 'supplier' or 'customer'
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [supplierDropdownIndex, setSupplierDropdownIndex] = useState(-1);
  const [customerDropdownIndex, setCustomerDropdownIndex] = useState(-1);

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
    return cashPaymentsResponse?.data?.cashPayments || cashPaymentsResponse?.cashPayments || cashPaymentsResponse?.data?.data?.cashPayments || [];
  }, [cashPaymentsResponse]);

  const { data: bankPaymentsResponse, isFetching: bankExpensesLoading } = useGetBankPaymentsQuery(
    { limit: 20 }
  );
  const bankPaymentsData = useMemo(() => {
    return bankPaymentsResponse?.data?.bankPayments || bankPaymentsResponse?.bankPayments || bankPaymentsResponse?.data?.data?.bankPayments || [];
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

  const { suppliers } = useDebouncedSupplierSearch(supplierSearchTerm, { selectedSupplier });
  const { customers } = useDebouncedCustomerSearch(customerSearchTerm, { selectedCustomer });

  const handleSupplierSelect = (supplierId) => {
    const supplier = suppliers.find(s => (s.id || s._id) === supplierId);
    setSelectedSupplier(supplier);
    setFormData(prev => ({ ...prev, supplier: supplierId, customer: '' }));
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
  };

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find(c => (c.id || c._id) === customerId);
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customer: customerId, supplier: '' }));
    setSelectedSupplier(null);
    setSupplierSearchTerm('');
  };

  const handleSupplierSearch = (searchTerm) => {
    setSupplierSearchTerm(searchTerm);
    setSupplierDropdownIndex(-1);
    if (searchTerm === '') {
      setSelectedSupplier(null);
      setFormData(prev => ({ ...prev, supplier: '' }));
    }
  };

  const handleCustomerSearch = (searchTerm) => {
    setCustomerSearchTerm(searchTerm);
    setCustomerDropdownIndex(-1);
    if (searchTerm === '') {
      setSelectedCustomer(null);
      setFormData(prev => ({ ...prev, customer: '' }));
    }
  };

  const handleSupplierKeyDown = (e) => {
    if (!supplierSearchTerm || (suppliers || []).length === 0) return;
    const filteredSuppliers = suppliers || [];
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSupplierDropdownIndex(prev => prev < filteredSuppliers.length - 1 ? prev + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSupplierDropdownIndex(prev => prev > 0 ? prev - 1 : filteredSuppliers.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (supplierDropdownIndex >= 0 && supplierDropdownIndex < filteredSuppliers.length) {
          const s = filteredSuppliers[supplierDropdownIndex];
          handleSupplierSelect(s.id || s._id);
          setSupplierSearchTerm(s.displayName || s.companyName || s.name || '');
          setSupplierDropdownIndex(-1);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSupplierSearchTerm('');
        setSupplierDropdownIndex(-1);
        break;
    }
  };

  const handleCustomerKeyDown = (e) => {
    if (!customerSearchTerm || (customers || []).length === 0) return;
    const filteredCustomers = customers || [];
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setCustomerDropdownIndex(prev => prev < filteredCustomers.length - 1 ? prev + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setCustomerDropdownIndex(prev => prev > 0 ? prev - 1 : filteredCustomers.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (customerDropdownIndex >= 0 && customerDropdownIndex < filteredCustomers.length) {
          const c = filteredCustomers[customerDropdownIndex];
          const name = c.businessName || c.business_name || c.displayName || c.name || '';
          handleCustomerSelect(c.id || c._id);
          setCustomerSearchTerm(name);
          setCustomerDropdownIndex(-1);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setCustomerSearchTerm('');
        setCustomerDropdownIndex(-1);
        break;
    }
  };

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
    setSupplierSearchTerm('');
    setCustomerSearchTerm('');
    setSelectedSupplier(null);
    setSelectedCustomer(null);
    setPartyType('supplier');
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
        bank: formData.bank,
        supplier: formData.supplier || undefined,
        customer: formData.customer || undefined
      });
    } else {
      handleCashExpenseSubmit({
        ...basePayload,
        supplier: formData.supplier || undefined,
        customer: formData.customer || undefined
      });
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
      particular: expense.particular || '',
      supplier: expense.supplier?._id || expense.supplier || '',
      customer: expense.customer?._id || expense.customer || ''
    });

    if (expense.supplier) {
      setPartyType('supplier');
      const s = expense.supplier;
      setSelectedSupplier(s);
      setSupplierSearchTerm(s.displayName || s.companyName || s.name || '');
    } else if (expense.customer) {
      setPartyType('customer');
      const c = expense.customer;
      setSelectedCustomer(c);
      setCustomerSearchTerm(c.businessName || c.business_name || c.displayName || c.name || '');
    }
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
            ${expense.supplier || expense.customer ? `
            <tr>
              <td class="label">Party</td>
              <td>${expense.supplier?.displayName || expense.customer?.displayName || '-'}</td>
            </tr>
            ` : ''}
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
                  <Button
                    type="button"
                    onClick={resetForm}
                    variant="outline"
                    size="default"
                    className="flex items-center justify-center gap-2 text-xs sm:text-sm"
                  >
                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>Reset</span>
                  </Button>
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
                <Input
                  type="text"
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

              <div className="pt-2">
                <label className="form-label mb-3 text-gray-600">Party Association (Optional)</label>
                <div className="flex items-center gap-6 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      value="supplier"
                      checked={partyType === 'supplier'}
                      onChange={(e) => {
                        setPartyType(e.target.value);
                        setSelectedCustomer(null);
                        setCustomerSearchTerm('');
                        setFormData(prev => ({ ...prev, customer: '' }));
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Supplier</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      value="customer"
                      checked={partyType === 'customer'}
                      onChange={(e) => {
                        setPartyType(e.target.value);
                        setSelectedSupplier(null);
                        setSupplierSearchTerm('');
                        setFormData(prev => ({ ...prev, supplier: '' }));
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Customer</span>
                  </label>
                </div>

                {partyType === 'supplier' ? (
                  <div className="relative">
                    <div className="relative">
                      <Input
                        type="text"
                        autoComplete="off"
                        value={supplierSearchTerm}
                        onChange={(e) => handleSupplierSearch(e.target.value)}
                        onKeyDown={handleSupplierKeyDown}
                        className="w-full pr-10"
                        placeholder="Search or select supplier..."
                      />
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    {supplierSearchTerm && !selectedSupplier && (
                      <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                        {(suppliers || []).map((supplier, index) => (
                          <div
                            key={supplier.id || supplier._id}
                            onClick={() => {
                              handleSupplierSelect(supplier.id || supplier._id);
                              setSupplierSearchTerm(supplier.displayName || supplier.companyName || supplier.name || '');
                              setSupplierDropdownIndex(-1);
                            }}
                            className={`px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${supplierDropdownIndex === index ? 'bg-blue-50' : ''}`}
                          >
                            <div className="font-medium text-sm text-gray-900">{supplier.displayName || supplier.companyName || supplier.name || 'Unknown'}</div>
                            <div className="text-xs text-gray-600">{supplier.phone}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedSupplier && (
                      <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center space-x-3">
                          <Building className="h-4 w-4 text-gray-400" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{selectedSupplier.displayName || selectedSupplier.companyName || selectedSupplier.name}</p>
                            {selectedSupplier.phone && <p className="text-xs text-gray-500">{selectedSupplier.phone}</p>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Input
                        type="text"
                        autoComplete="off"
                        value={customerSearchTerm}
                        onChange={(e) => handleCustomerSearch(e.target.value)}
                        onKeyDown={handleCustomerKeyDown}
                        className="w-full pr-10"
                        placeholder="Search or select customer..."
                      />
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    {customerSearchTerm && !selectedCustomer && (
                      <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                        {(customers || []).map((customer, index) => (
                          <div
                            key={customer.id || customer._id}
                            onClick={() => {
                              const name = customer.businessName || customer.business_name || customer.displayName || customer.name || '';
                              handleCustomerSelect(customer.id || customer._id);
                              setCustomerSearchTerm(name);
                              setCustomerDropdownIndex(-1);
                            }}
                            className={`px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${customerDropdownIndex === index ? 'bg-blue-50' : ''}`}
                          >
                            <div className="font-medium text-sm text-gray-900">{customer.businessName || customer.business_name || customer.displayName || customer.name || 'Unknown'}</div>
                            <div className="text-xs text-gray-600">{customer.phone}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedCustomer && (
                      <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center space-x-3">
                          <User className="h-4 w-4 text-gray-400" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{selectedCustomer.businessName || selectedCustomer.business_name || selectedCustomer.displayName || selectedCustomer.name}</p>
                            {selectedCustomer.phone && <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            <div className="space-y-4">
              <div>
                <label className="form-label">Notes</label>
                <Textarea
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
                <Button
                  type="submit"
                  variant="default"
                  size="default"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto"
                  disabled={
                    creatingCashPayment ||
                    updatingCashPayment ||
                    creatingBankPayment ||
                    updatingBankPayment
                  }
                >
                  <Plus className="h-4 w-4" />
                  <span>{editingExpense ? 'Update Expense' : 'Save Expense'}</span>
                </Button>
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
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Party</th>
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
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {expense.supplier?.displayName || expense.customer?.displayName || '—'}
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
