import React, { useMemo, useState } from 'react';
import {
  ClipboardList,
  RotateCcw,
  ArrowLeftRight,
  Eye,
  Printer,
  Pencil,
  Trash2,
  Landmark,
  FileText,
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDate } from '../utils/formatters';
import RecurringExpensesPanel from '../components/RecurringExpensesPanel';
import { getLocalDateString, getDateDaysAgo } from '../utils/dateUtils';
import DateFilter from '../components/DateFilter';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';
import { PrintModal } from '../components/print';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import {
  PaymentFormCard,
  PaymentFormGrid,
  PaymentFormColumn,
  PaymentFormSection,
  PaymentPartyTypeRadio,
  PaymentFormField,
  PaymentAmountField,
  PaymentDateField,
  PaymentBankSelect,
  PaymentFormActions,
  paymentFormInputClass,
} from '@/components/payments/PaymentFormLayout';
import {
  PaymentCustomerField,
  PaymentSupplierField,
  partyIdFromSelect,
  customerSearchLabel,
  supplierSearchLabel,
} from '@/components/payments/PaymentPartyFields';
import { PageLayout } from '@/components/layout/PageLayout';

const today = getLocalDateString();

/** Expense entries have no supplier/customer party (Record Expense), unlike Cash/Bank Payments to parties. */
function isExpensePaymentEntry(payment) {
  if (!payment) return false;
  const supplierId =
    payment.supplier?.id ||
    payment.supplier?._id ||
    payment.supplier_id ||
    payment.supplierId;
  const customerId =
    payment.customer?.id ||
    payment.customer?._id ||
    payment.customer_id ||
    payment.customerId;
  return !supplierId && !customerId;
}

function getExpenseDateKey(expense) {
  const raw = expense?.date || expense?.createdAt;
  if (!raw) return '';
  if (typeof raw === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (raw.includes('T')) return raw.split('T')[0];
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : getLocalDateString(parsed);
}

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
  const {
    confirmation: deleteConfirmation,
    confirmDelete,
    handleConfirm: handleDeleteConfirm,
    handleCancel: handleDeleteCancel,
  } = useDeleteConfirmation();
  const [formData, setFormData] = useState(defaultFormState);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [recentFromDate, setRecentFromDate] = useState(() => getDateDaysAgo(30));
  const [recentToDate, setRecentToDate] = useState(() => getLocalDateString());
  const [editingExpense, setEditingExpense] = useState(null);
  const [partyType, setPartyType] = useState('supplier'); // 'supplier' or 'customer'
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [printExpense, setPrintExpense] = useState(null);
  const { companyInfo } = useCompanyInfo();

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

  const { data: banksResponse, isLoading: banksLoading } = useGetBanksQuery({ isActive: true, all: 'true' });
  const banks = useMemo(
    () => banksResponse?.data?.banks || banksResponse?.banks || banksResponse?.data || [],
    [banksResponse]
  );

  const recentListQuery = {
    limit: 100,
    expenseOnly: true,
    ...(recentFromDate ? { fromDate: recentFromDate } : {}),
    ...(recentToDate ? { toDate: recentToDate } : {}),
  };

  const { data: cashPaymentsResponse, isFetching: cashExpensesLoading } = useGetCashPaymentsQuery(
    recentListQuery,
    { refetchOnMountOrArgChange: true }
  );
  const cashPaymentsData = useMemo(() => {
    return cashPaymentsResponse?.data?.cashPayments || cashPaymentsResponse?.cashPayments || cashPaymentsResponse?.data?.data?.cashPayments || [];
  }, [cashPaymentsResponse]);

  const { data: bankPaymentsResponse, isFetching: bankExpensesLoading } = useGetBankPaymentsQuery(
    recentListQuery,
    { refetchOnMountOrArgChange: true }
  );
  const bankPaymentsData = useMemo(() => {
    return bankPaymentsResponse?.data?.bankPayments || bankPaymentsResponse?.bankPayments || bankPaymentsResponse?.data?.data?.bankPayments || [];
  }, [bankPaymentsResponse]);

  const combinedRecentExpenses = useMemo(() => {
    const apiResults = [
      ...(cashPaymentsData || []).filter(isExpensePaymentEntry).map((item) => ({ ...item, source: 'cash' })),
      ...(bankPaymentsData || []).filter(isExpensePaymentEntry).map((item) => ({ ...item, source: 'bank' })),
      ...recentExpenses.filter(isExpensePaymentEntry),
    ];

    return apiResults
      .filter((item, index, self) => item?._id && index === self.findIndex((s) => s._id === item._id))
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
      .slice(0, 100);
  }, [cashPaymentsData, bankPaymentsData, recentExpenses]);

  const expensesByDate = useMemo(() => {
    const groups = new Map();
    combinedRecentExpenses.forEach((expense) => {
      const key = getExpenseDateKey(expense) || 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(expense);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, items]) => ({
        dateKey,
        items,
        total: items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
      }));
  }, [combinedRecentExpenses]);

  const recentGrandTotal = useMemo(
    () => combinedRecentExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [combinedRecentExpenses]
  );

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

  const handleSupplierSelect = (supplierOrId) => {
    const supplierId = partyIdFromSelect(supplierOrId);
    if (!supplierId) return;
    const supplier =
      typeof supplierOrId === 'object' && supplierOrId
        ? supplierOrId
        : suppliers.find((s) => (s.id || s._id) === supplierId);
    setSelectedSupplier(supplier || null);
    setSupplierSearchTerm(supplier ? supplierSearchLabel(supplier) : '');
    setFormData(prev => ({ ...prev, supplier: supplierId, customer: '' }));
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
  };

  const handleCustomerSelect = (customerOrId) => {
    const customerId = partyIdFromSelect(customerOrId);
    if (!customerId) return;
    const customer =
      typeof customerOrId === 'object' && customerOrId
        ? customerOrId
        : customers.find((c) => (c.id || c._id) === customerId);
    setSelectedCustomer(customer || null);
    setCustomerSearchTerm(customer ? customerSearchLabel(customer) : '');
    setFormData(prev => ({ ...prev, customer: customerId, supplier: '' }));
    setSelectedSupplier(null);
    setSupplierSearchTerm('');
  };

  const handleSupplierSearch = (searchTerm) => {
    setSupplierSearchTerm(searchTerm);
    if (searchTerm === '') {
      setSelectedSupplier(null);
      setFormData(prev => ({ ...prev, supplier: '' }));
    }
  };

  const handleCustomerSearch = (searchTerm) => {
    setCustomerSearchTerm(searchTerm);
    if (searchTerm === '') {
      setSelectedCustomer(null);
      setFormData(prev => ({ ...prev, customer: '' }));
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

  const handleDeleteExpense = (expense) => {
    const label = expense?.voucherCode || expense?.payment_number || expense?.particular || `${expense?._id || 'this expense'}`;
    confirmDelete(label, 'Expense', async () => {
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
        throw error;
      }
    });
  };

  const handleViewExpense = (expense) => {
    setPrintExpense(expense);
  };

  const handlePrintExpense = (expense) => {
    setPrintExpense(expense);
  };

  const isSaving =
    creatingCashPayment ||
    updatingCashPayment ||
    creatingBankPayment ||
    updatingBankPayment;

  const expenseActionBtnClass =
    'rounded-md p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900';

  return (
    <PageLayout>
      <PaymentFormCard variant="expense">
        <form onSubmit={handleSubmit}>
          <PaymentFormGrid>
            <PaymentFormColumn>
              <PaymentFormSection
                title="Payment Method"
                description="Pay from cash on hand or a bank account"
                icon={Landmark}
              >
                <PaymentPartyTypeRadio
                  label="Pay From"
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'bank', label: 'Bank' },
                  ]}
                  onOptionChange={(type) => {
                    if (type === 'cash') {
                      setFormData((prev) => ({ ...prev, bank: '' }));
                    }
                  }}
                />
              </PaymentFormSection>

              <PaymentFormSection
                title="Expense Details"
                description="Account, amount, date, and optional party"
                icon={ClipboardList}
              >
                <div className="flex items-center justify-between gap-2">
                  <PaymentFormField label="Expense Account" required className="flex-1">
                    <select
                      className={paymentFormInputClass}
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
                  </PaymentFormField>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="mt-6 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    <span>Reset</span>
                  </button>
                </div>
                {selectedAccount ? (
                  <p className="text-xs text-neutral-500">
                    Selected account will be debited when this expense is posted.
                  </p>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <PaymentAmountField
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, amount: e.target.value }))
                    }
                  />
                  <PaymentDateField
                    value={formData.date}
                    onChange={(date) =>
                      setFormData((prev) => ({ ...prev, date }))
                    }
                  />
                </div>

                <PaymentFormField label="Description (optional)">
                  <Input
                    type="text"
                    className={paymentFormInputClass}
                    placeholder={
                      selectedAccount ? selectedAccount.accountName : 'e.g., Rent for November'
                    }
                    value={formData.particular}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, particular: e.target.value }))
                    }
                  />
                </PaymentFormField>

                {paymentMethod === 'bank' ? (
                  <PaymentBankSelect
                    value={formData.bank}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, bank: e.target.value }))
                    }
                    banks={banks}
                    loading={banksLoading}
                  />
                ) : null}

                <div className="border-t border-neutral-200 pt-4">
                  <PaymentPartyTypeRadio
                    label="Party Association (Optional)"
                    value={partyType}
                    onChange={setPartyType}
                    onOptionChange={(type) => {
                      if (type === 'supplier') {
                        setSelectedCustomer(null);
                        setCustomerSearchTerm('');
                        setFormData((prev) => ({ ...prev, customer: '' }));
                        return;
                      }
                      setSelectedSupplier(null);
                      setSupplierSearchTerm('');
                      setFormData((prev) => ({ ...prev, supplier: '' }));
                    }}
                    className="mb-4"
                  />
                  {partyType === 'supplier' ? (
                    <PaymentSupplierField
                      suppliers={suppliers}
                      selectedSupplier={selectedSupplier}
                      onSelect={handleSupplierSelect}
                      onSearch={handleSupplierSearch}
                      searchValue={supplierSearchTerm}
                      placeholder="Search or select supplier..."
                    />
                  ) : (
                    <PaymentCustomerField
                      customers={customers}
                      selectedCustomer={selectedCustomer}
                      onSelect={handleCustomerSelect}
                      onSearch={handleCustomerSearch}
                      searchValue={customerSearchTerm}
                      placeholder="Search or select customer..."
                    />
                  )}
                </div>
              </PaymentFormSection>
            </PaymentFormColumn>

            <PaymentFormColumn>
              <PaymentFormSection
                title="Notes & Posting"
                description="Internal notes and ledger preview"
                icon={FileText}
              >
                <PaymentFormField label="Notes">
                  <Textarea
                    rows={5}
                    className="min-h-[120px] rounded-lg border-neutral-200 bg-white text-sm shadow-sm focus-visible:ring-neutral-300"
                    placeholder="Optional internal notes..."
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, notes: e.target.value }))
                    }
                  />
                </PaymentFormField>

                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Posting Preview
                  </h3>
                  <div className="space-y-2.5 text-sm text-neutral-700">
                    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-2">
                      <span className="font-medium text-neutral-500">Debit</span>
                      <span className="text-right text-neutral-900">
                        {selectedAccount
                          ? `${selectedAccount.accountName} (${selectedAccount.accountCode})`
                          : 'Select expense account'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-2">
                      <span className="font-medium text-neutral-500">Credit</span>
                      <span className="text-neutral-900">
                        {paymentMethod === 'cash' ? 'Cash on Hand' : 'Bank Account'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-neutral-500">Amount</span>
                      <span className="text-lg font-bold tabular-nums text-neutral-900">
                        {formData.amount
                          ? formatCurrency(parseFloat(formData.amount) || 0)
                          : formatCurrency(0)}
                      </span>
                    </div>
                  </div>
                </div>
              </PaymentFormSection>
            </PaymentFormColumn>
          </PaymentFormGrid>

          <PaymentFormActions
            onReset={resetForm}
            onSubmit={() => handleSubmit({ preventDefault: () => {} })}
            isSubmitting={isSaving}
            submitLabel={editingExpense ? 'Update Expense' : 'Save Expense'}
            submittingLabel={editingExpense ? 'Updating...' : 'Saving...'}
          />
        </form>
      </PaymentFormCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 sm:px-5 sm:py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900 sm:text-lg">
              <ArrowLeftRight className="h-5 w-5 text-neutral-700" aria-hidden />
              <span>Recent Expense Entries</span>
            </h2>
            {(cashExpensesLoading || bankExpensesLoading) && (
              <span className="text-xs text-neutral-500">Refreshing...</span>
            )}
          </div>
          <div className="border-b border-neutral-200 px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1 max-w-xl">
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Date range</label>
                <DateFilter
                  startDate={recentFromDate}
                  endDate={recentToDate}
                  onDateChange={(start, end) => {
                    setRecentFromDate(start || '');
                    setRecentToDate(end || '');
                  }}
                  compact
                  showPresets
                  showClear
                />
              </div>
              {combinedRecentExpenses.length > 0 && (
                <div className="text-right text-sm text-neutral-600 shrink-0">
                  <span className="font-medium text-neutral-900">{combinedRecentExpenses.length}</span> entries
                  <span className="mx-1.5 text-neutral-300">·</span>
                  Total <span className="font-semibold tabular-nums text-neutral-900">{formatCurrency(recentGrandTotal)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="p-4 sm:p-5">
            {combinedRecentExpenses.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No expense entries in this date range. Adjust the filter or record a new expense above.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Voucher</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Expense Account</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Description</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Party</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">Amount</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">Method</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 bg-white">
                    {expensesByDate.map(({ dateKey, items, total }) => (
                      <React.Fragment key={dateKey}>
                        <tr className="bg-neutral-100/80">
                          <td colSpan={7} className="px-4 py-2.5 text-sm font-semibold text-neutral-800">
                            <span>{dateKey !== 'unknown' ? formatDate(dateKey) : 'Unknown date'}</span>
                            <span className="mx-2 font-normal text-neutral-400">·</span>
                            <span className="font-normal text-neutral-600">
                              {items.length} {items.length === 1 ? 'entry' : 'entries'}
                            </span>
                            <span className="mx-2 font-normal text-neutral-400">·</span>
                            <span className="font-normal text-neutral-600">
                              Day total <span className="font-semibold tabular-nums text-neutral-900">{formatCurrency(total)}</span>
                            </span>
                          </td>
                        </tr>
                        {items.map((expense) => (
                          <tr key={expense._id} className="hover:bg-neutral-50">
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-700">
                              {expense.voucherCode || expense._id}
                            </td>
                            <td className="px-4 py-3 text-sm text-neutral-700">
                              {expense.expenseAccount?.accountName
                                ? `${expense.expenseAccount.accountName} (${expense.expenseAccount.accountCode})`
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-neutral-600">
                              {expense.particular || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-neutral-600">
                              {expense.supplier?.displayName || expense.customer?.displayName || '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-neutral-900">
                              {formatCurrency(expense.amount || 0)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-center text-sm capitalize text-neutral-600">
                              {resolvePaymentMethodLabel(expense)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-neutral-600">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleViewExpense(expense)}
                                  className={expenseActionBtnClass}
                                  title="View Expense"
                                >
                                  <Eye className="h-4 w-4" aria-hidden />
                                  <span className="sr-only">View</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePrintExpense(expense)}
                                  className={expenseActionBtnClass}
                                  title="Print Expense"
                                >
                                  <Printer className="h-4 w-4" aria-hidden />
                                  <span className="sr-only">Print</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditExpense(expense)}
                                  className={expenseActionBtnClass}
                                  title="Edit Expense"
                                >
                                  <Pencil className="h-4 w-4" aria-hidden />
                                  <span className="sr-only">Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExpense(expense)}
                                  className={expenseActionBtnClass}
                                  title="Delete Expense"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                  <span className="sr-only">Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
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

      <DeleteConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        itemName={deleteConfirmation.message?.match(/"([^"]*)"/)?.[1] || ''}
        itemType="Expense"
        isLoading={deleteConfirmation.isLoading}
      />

      {/* Expense Voucher Print Modal */}
      {printExpense && (
        <PrintModal
          isOpen={!!printExpense}
          onClose={() => setPrintExpense(null)}
          documentTitle="Expense Voucher"
          hasData={!!printExpense}
          emptyMessage="No expense data."
        >
          <div className="print-document bg-white p-8 max-w-[500px] mx-auto">
            <div className="text-center mb-5 border-b-2 border-black pb-3">
              <div className="text-xl font-black uppercase">
                {companyInfo?.companyName || 'POS SYSTEM'}
              </div>
              {companyInfo?.address && (
                <div className="text-xs text-gray-600 mt-1">{companyInfo.address}</div>
              )}
              <div className="text-base font-bold mt-2">Expense Voucher</div>
            </div>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold bg-gray-50 w-[35%]">Voucher ID</td>
                  <td className="border border-gray-300 p-2">{printExpense.voucherCode || printExpense._id}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold bg-gray-50">Date</td>
                  <td className="border border-gray-300 p-2">{formatDate(printExpense.date || printExpense.createdAt)}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold bg-gray-50">Payment Method</td>
                  <td className="border border-gray-300 p-2">{printExpense.source === 'bank' ? 'Bank' : 'Cash'}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold bg-gray-50">Expense Account</td>
                  <td className="border border-gray-300 p-2">
                    {printExpense.expenseAccount?.accountName
                      ? `${printExpense.expenseAccount.accountName} (${printExpense.expenseAccount.accountCode || ''})`
                      : 'Expense Account'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold bg-gray-50">Amount</td>
                  <td className="border border-gray-300 p-2 font-bold">{formatCurrency(printExpense.amount || 0)}</td>
                </tr>
                {(printExpense.supplier || printExpense.customer) && (
                  <tr>
                    <td className="border border-gray-300 p-2 font-semibold bg-gray-50">Party</td>
                    <td className="border border-gray-300 p-2">
                      {printExpense.supplier?.displayName || printExpense.customer?.displayName || '-'}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold bg-gray-50">Description</td>
                  <td className="border border-gray-300 p-2">{printExpense.particular || '-'}</td>
                </tr>
                {printExpense.notes && (
                  <tr>
                    <td className="border border-gray-300 p-2 font-semibold bg-gray-50">Notes</td>
                    <td className="border border-gray-300 p-2">{printExpense.notes}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="mt-6 pt-3 border-t text-center text-[10px] text-gray-400">
              Generated on {formatDate(new Date().toISOString())}
            </div>
          </div>
        </PrintModal>
      )}
    </PageLayout>
  );
};

export default Expenses;
