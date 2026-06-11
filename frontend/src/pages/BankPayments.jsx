import React, { useState, useEffect } from 'react';
import BaseModal from '../components/BaseModal';
import {
  Search,
  Calendar,
} from 'lucide-react';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { formatDate } from '../utils/formatters';
import { getCustomerDisplayName, getSupplierDisplayName } from '../utils/partyDisplay';
import ReceiptPaymentPrintModal from '../components/ReceiptPaymentPrintModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useGetBankPaymentsQuery,
  useCreateBankPaymentMutation,
  useUpdateBankPaymentMutation,
  useDeleteBankPaymentMutation,

} from '../store/services/bankPaymentsApi';
import { suppliersApi } from '../store/services/suppliersApi';
import { customersApi } from '../store/services/customersApi';
import { useAppDispatch } from '../store/hooks';
import { useDebouncedCustomerSearch } from '../hooks/useDebouncedCustomerSearch';
import { useDebouncedSupplierSearch } from '../hooks/useDebouncedSupplierSearch';
import { useGetAccountsQuery } from '../store/services/chartOfAccountsApi';
import { useGetBanksQuery } from '../store/services/banksApi';
import DateFilter from '../components/DateFilter';
import { InputWithIcon } from '@/components/ui/input-with-icon';
import { getCurrentDatePakistan, formatDateForInput } from '../utils/dateUtils';
import { useSensitiveDataPermissions } from '../hooks/useSensitiveDataPermissions';
import { useListControls } from '../hooks/useListControls';
import { getPaginationInfo } from '../utils/paginationInfo';
import { FiltersCard } from '../components/list/FiltersCard';
import { ListResultsHeader } from '../components/list/ListResultsHeader';
import { SortableTableHeader } from '../components/list/SortableTableHeader';
import { DataStateMessage } from '../components/list/DataStateMessage';
import { RowActionButtons } from '../components/list/RowActionButtons';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';
import FormField from '@/components/FormField';
import {
  PaymentFormCard,
  PaymentFormGrid,
  PaymentFormColumn,
  PaymentFormSection,
  PaymentPartyTypeRadio,
  PaymentFormField,
  PaymentAmountField,
  PaymentDateField,
  PaymentBalancePanel,
  PaymentBankSelect,
  PaymentFormActions,
  paymentFormInputClass,
} from '@/components/payments/PaymentFormLayout';
import { Users, Landmark, FileText } from 'lucide-react';
import {
  PaymentCustomerField,
  PaymentSupplierField,
  PaymentExpenseAccountField,
  partyIdFromSelect,
  customerSearchLabel,
  supplierSearchLabel,
} from '@/components/payments/PaymentPartyFields';
import { PageLayout } from '@/components/layout/PageLayout';


const BankPayments = () => {
  const {
    canViewCustomerBalance,
    canViewSupplierBalance,
    canViewSupplierPhone
  } = useSensitiveDataPermissions();
  const today = getCurrentDatePakistan();
  const {
    confirmation: deleteConfirmation,
    confirmDelete,
    handleConfirm: handleDeleteConfirm,
    handleCancel: handleDeleteCancel,
  } = useDeleteConfirmation();
  // State for filters and pagination
  // State for filters / pagination / sort lives in `useListControls`.
  const {
    filters,
    setFilters,
    pagination,
    setPagination,
    sortConfig,
    setFilter: handleFilterChange,
    toggleSort: handleSort,
  } = useListControls({
    initialFilters: {
      fromDate: today,
      toDate: today,
      voucherCode: '',
      amount: '',
      particular: '',
    },
  });

  // State for modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [printData, setPrintData] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    date: today,
    amount: '',
    particular: '',
    bank: '',
    transactionReference: '',
    supplier: '',
    customer: '',
    notes: ''
  });

  // Supplier/Customer/Expense selection state
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedExpenseAccount, setSelectedExpenseAccount] = useState(null);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [expenseSearchTerm, setExpenseSearchTerm] = useState('');
  const [paymentType, setPaymentType] = useState('supplier'); // 'supplier', 'customer', or 'expense'

  // Fetch bank payments
  const {
    data: bankPaymentsData,
    isLoading,
    error,
    refetch,
  } = useGetBankPaymentsQuery({ ...filters, ...pagination, sortConfig }, { refetchOnMountOrArgChange: true });

  const dispatch = useAppDispatch();

  const { suppliers, isLoading: suppliersLoading, isFetching: suppliersFetching } = useDebouncedSupplierSearch(
    supplierSearchTerm,
    { selectedSupplier }
  );
  const { customers, isLoading: customersLoading, isFetching: customersFetching } = useDebouncedCustomerSearch(
    customerSearchTerm,
    { selectedCustomer }
  );

  const invalidateCustomersList = () => {
    dispatch(customersApi.util.invalidateTags([{ type: 'Customers', id: 'LIST' }]));
  };
  const invalidateSuppliersList = () => {
    dispatch(suppliersApi.util.invalidateTags([{ type: 'Suppliers', id: 'LIST' }]));
  };

  // Fetch banks for dropdown
  const { data: banksData, isLoading: banksLoading, error: banksError } = useGetBanksQuery(
    { isActive: true, all: 'true' },
    { refetchOnMountOrArgChange: true }
  );
  const banks = React.useMemo(() => {
    return banksData?.data?.banks || banksData?.banks || banksData || [];
  }, [banksData]);

  // Fetch expense accounts from Chart of Accounts
  const { data: expenseAccountsData, isLoading: expenseAccountsLoading } = useGetAccountsQuery(
    { accountType: 'expense', isActive: 'true' },
    { refetchOnMountOrArgChange: true }
  );

  const expenseAccounts = React.useMemo(() => {
    return expenseAccountsData?.data || expenseAccountsData?.accounts || (Array.isArray(expenseAccountsData) ? expenseAccountsData : []);
  }, [expenseAccountsData]);

  // Update selected supplier when suppliers data changes
  useEffect(() => {
    if (selectedSupplier && suppliers.length > 0) {
      const updatedSupplier = suppliers.find(s => (s.id || s._id) === (selectedSupplier.id || selectedSupplier._id));
      if (updatedSupplier && (
        updatedSupplier.pendingBalance !== selectedSupplier.pendingBalance ||
        updatedSupplier.advanceBalance !== selectedSupplier.advanceBalance ||
        updatedSupplier.currentBalance !== selectedSupplier.currentBalance
      )) {
        setSelectedSupplier(updatedSupplier);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: selectedSupplier is intentionally excluded from deps to prevent infinite loops.
    // We only want to sync when the suppliers list updates, not when selectedSupplier changes.
  }, [suppliers]);

  // Update selected customer when customers data changes
  useEffect(() => {
    if (selectedCustomer && customers) {
      const updatedCustomer = customers.find(c => (c.id || c._id) === (selectedCustomer.id || selectedCustomer._id));
      if (updatedCustomer && (
        updatedCustomer.pendingBalance !== selectedCustomer.pendingBalance ||
        updatedCustomer.advanceBalance !== selectedCustomer.advanceBalance ||
        updatedCustomer.currentBalance !== selectedCustomer.currentBalance
      )) {
        setSelectedCustomer(updatedCustomer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: selectedCustomer is intentionally excluded from deps to prevent infinite loops.
    // We only want to sync when the customers list updates, not when selectedCustomer changes.
  }, [customers]);

  // Mutations
  const [createBankPayment, { isLoading: creating }] = useCreateBankPaymentMutation();
  const [updateBankPayment, { isLoading: updating }] = useUpdateBankPaymentMutation();
  const [deleteBankPayment, { isLoading: deleting }] = useDeleteBankPaymentMutation();


  // Helper functions
  const resetForm = () => {
    setFormData({
      date: getCurrentDatePakistan(),
      amount: '',
      particular: '',
      bank: '',
      transactionReference: '',
      supplier: '',
      customer: '',
      notes: ''
    });
    setSelectedSupplier(null);
    setSelectedCustomer(null);
    setSelectedExpenseAccount(null);
    setSupplierSearchTerm('');
    setCustomerSearchTerm('');
    setExpenseSearchTerm('');
    setPaymentType('supplier');
  };

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

  const handleExpenseAccountSelect = (accountOrId) => {
    const accountId = partyIdFromSelect(accountOrId);
    const account =
      typeof accountOrId === 'object' && accountOrId
        ? accountOrId
        : expenseAccounts.find((a) => (a.id || a._id) === accountId);
    setSelectedExpenseAccount(account);
    setExpenseSearchTerm(account?.accountName || '');
    setFormData(prev => ({ ...prev, particular: account?.accountName || '' }));
  };

  const handleExpenseSearch = (searchTerm) => {
    setExpenseSearchTerm(searchTerm);
    if (searchTerm === '') {
      setSelectedExpenseAccount(null);
      setFormData(prev => ({ ...prev, particular: '' }));
    }
  };


  const handleCreate = () => {
    // Validation
    if (!formData.amount || formData.amount <= 0) {
      showErrorToast('Please enter a valid amount');
      return;
    }

    if (!formData.bank) {
      showErrorToast('Please select a bank account');
      return;
    }

    if (paymentType === 'expense' && !selectedExpenseAccount) {
      showErrorToast('Please select an expense account');
      return;
    }

    if (paymentType === 'supplier' && !selectedSupplier) {
      showErrorToast('Please select a supplier');
      return;
    }

    if (paymentType === 'customer' && !selectedCustomer) {
      showErrorToast('Please select a customer');
      return;
    }

    // Prepare data for submission
    const submissionData = {
      date: formData.date,
      amount: parseFloat(formData.amount),
      particular: formData.particular || undefined,
      bank: formData.bank,
      transactionReference: formData.transactionReference || undefined,
      notes: formData.notes || undefined
    };

    // Only include supplier or customer if they have values (not empty strings)
    if (paymentType === 'supplier' && formData.supplier) {
      submissionData.supplier = formData.supplier;
    } else if (paymentType === 'customer' && formData.customer) {
      submissionData.customer = formData.customer;
    }

    // Include expense account if it's an expense payment
    if (paymentType === 'expense' && selectedExpenseAccount?._id) {
      submissionData.expenseAccount = selectedExpenseAccount._id;
    }

    createBankPayment(submissionData)
      .unwrap()
      .then(() => {
        resetForm();
        showSuccessToast('Bank payment created successfully');
        refetch();
        // Refetch customer/supplier data to update balances immediately
        if (paymentType === 'customer' && formData.customer) {
          invalidateCustomersList();
        } else if (paymentType === 'supplier' && formData.supplier) {
          invalidateSuppliersList();
        }
      })
      .catch((error) => {
        showErrorToast(handleApiError(error));
      });
  };

  const handleUpdate = () => {
    // Prepare data for update
    const submissionData = {
      date: formData.date,
      amount: parseFloat(formData.amount),
      particular: formData.particular,
      bank: formData.bank,
      transactionReference: formData.transactionReference,
      supplier: paymentType === 'supplier' ? formData.supplier : undefined,
      customer: paymentType === 'customer' ? formData.customer : undefined,
      expenseAccount: paymentType === 'expense' ? selectedExpenseAccount?._id : undefined,
      notes: formData.notes
    };

    updateBankPayment({ id: selectedPayment.id || selectedPayment._id, ...submissionData })
      .unwrap()
      .then(() => {
        setShowEditModal(false);
        setSelectedPayment(null);
        resetForm();
        showSuccessToast('Bank payment updated successfully');
        refetch();
        // Refetch customer/supplier data to update balances immediately
        if (paymentType === 'customer' && formData.customer) {
          invalidateCustomersList();
        } else if (paymentType === 'supplier' && formData.supplier) {
          invalidateSuppliersList();
        }
      })
      .catch((error) => {
        showErrorToast(handleApiError(error));
      });
  };

  const handleDelete = (payment) => {
    const label = payment?.paymentNumber || payment?.transactionReference || `${payment?.id || payment?._id || 'this payment'}`;
    confirmDelete(label, 'Bank Payment', async () => {
      try {
        await deleteBankPayment(payment.id || payment._id).unwrap();
        showSuccessToast('Bank payment deleted successfully');
        refetch();
        if (payment.customer) {
          invalidateCustomersList();
        } else if (payment.supplier) {
          invalidateSuppliersList();
        }
      } catch (error) {
        showErrorToast(handleApiError(error));
        throw error;
      }
    });
  };

  const handleEdit = (payment) => {
    setSelectedPayment(payment);
    setFormData({
      date: payment.date ? payment.date.split('T')[0] : today,
      amount: payment.amount || '',
      particular: payment.particular || '',
      bank: payment.bank?._id || payment.bank?.id || payment.bank_id || payment.bankId || '',
      transactionReference: payment.transactionReference || '',
      supplier: payment.supplier?._id || payment.supplier?.id || '',
      customer: payment.customer?._id || payment.customer?.id || '',
      notes: payment.notes || ''
    });

    if (payment.supplier) {
      setPaymentType('supplier');
      setSelectedSupplier(payment.supplier);
      setSupplierSearchTerm(payment.supplier.displayName || payment.supplier.companyName || payment.supplier.name || '');
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
    } else if (payment.customer) {
      setPaymentType('customer');
      setSelectedCustomer(payment.customer);
      setCustomerSearchTerm(getCustomerDisplayName(payment.customer, ''));
      setSelectedSupplier(null);
      setSupplierSearchTerm('');
    } else if (payment.expenseAccount) {
      setPaymentType('expense');
      setSelectedExpenseAccount(payment.expenseAccount);
      setExpenseSearchTerm(payment.expenseAccount.accountName || '');
      setSelectedSupplier(null);
      setSelectedCustomer(null);
      setSupplierSearchTerm('');
      setCustomerSearchTerm('');
    }

    setShowEditModal(true);
  };

  const handleView = (payment) => {
    setSelectedPayment(payment);
    setShowViewModal(true);
  };



  const handlePrint = (payment) => {
    setPrintData(payment);
    setShowPrintModal(true);
  };

  const bankPayments =
    bankPaymentsData?.data?.bankPayments ||
    bankPaymentsData?.bankPayments ||
    bankPaymentsData?.data?.payments ||
    bankPaymentsData?.payments ||
    [];
  const resolveBankInfo = (payment) => {
    if (payment?.bank && typeof payment.bank === 'object') return payment.bank;
    const bankId = payment?.bank_id || payment?.bankId || payment?.bank;
    if (!bankId) return null;
    return (banks || []).find(b => (b._id || b.id) === bankId) || null;
  };
  const paginationInfo = getPaginationInfo(bankPaymentsData);

  return (
    <PageLayout>
      {/* Bank Payment Form */}
      <PaymentFormCard variant="bank-payment">
        <PaymentFormGrid>
          <PaymentFormColumn>
            <PaymentFormSection
              title="Party & Amount"
              description="Who was paid and the payment amount"
              icon={Users}
            >
            <PaymentPartyTypeRadio
              label="Payment Type"
              value={paymentType}
              onChange={setPaymentType}
              options={[
                { value: 'supplier', label: 'Supplier' },
                { value: 'customer', label: 'Customer' },
                { value: 'expense', label: 'Expense' },
              ]}
              onOptionChange={(type) => {
                if (type === 'supplier') {
                  setSelectedCustomer(null);
                  setCustomerSearchTerm('');
                  setSelectedExpenseAccount(null);
                  setExpenseSearchTerm('');
                  setFormData((prev) => ({ ...prev, customer: '', particular: '' }));
                  return;
                }
                if (type === 'customer') {
                  setSelectedSupplier(null);
                  setSupplierSearchTerm('');
                  setSelectedExpenseAccount(null);
                  setExpenseSearchTerm('');
                  setFormData((prev) => ({ ...prev, supplier: '', particular: '' }));
                  return;
                }
                setSelectedSupplier(null);
                setSelectedCustomer(null);
                setSupplierSearchTerm('');
                setCustomerSearchTerm('');
                setFormData((prev) => ({ ...prev, supplier: '', customer: '' }));
              }}
            />

            {paymentType === 'supplier' && (
              <PaymentSupplierField
                suppliers={suppliers}
                selectedSupplier={selectedSupplier}
                onSelect={handleSupplierSelect}
                onSearch={handleSupplierSearch}
                searchValue={supplierSearchTerm}
                loading={suppliersLoading || suppliersFetching}
                canViewBalance={canViewSupplierBalance}
                canViewPhone={canViewSupplierPhone}
              />
            )}

            {paymentType === 'customer' && (
              <PaymentCustomerField
                customers={customers}
                selectedCustomer={selectedCustomer}
                onSelect={handleCustomerSelect}
                onSearch={handleCustomerSearch}
                searchValue={customerSearchTerm}
                loading={customersLoading || customersFetching}
                canViewBalance={canViewCustomerBalance}
              />
            )}

            {paymentType === 'expense' && (
              <PaymentExpenseAccountField
                label="Expense Description"
                required
                accounts={expenseAccounts || []}
                selectedAccount={selectedExpenseAccount}
                onSelect={handleExpenseAccountSelect}
                onSearch={handleExpenseSearch}
                searchValue={expenseSearchTerm}
                placeholder="Search expense account (e.g., Rent Expense, Utilities Expense, etc.)"
              />
            )}

            {paymentType === 'supplier' && selectedSupplier && canViewSupplierBalance && (
              <PaymentBalancePanel
                balance={(selectedSupplier.pendingBalance || 0) - (selectedSupplier.advanceBalance || 0)}
                pendingBalance={selectedSupplier.pendingBalance}
                advanceBalance={selectedSupplier.advanceBalance}
              />
            )}
            {paymentType === 'customer' && selectedCustomer && canViewCustomerBalance && (
              <PaymentBalancePanel
                balance={(selectedCustomer.pendingBalance || 0) - (selectedCustomer.advanceBalance || 0)}
                pendingBalance={selectedCustomer.pendingBalance}
                advanceBalance={selectedCustomer.advanceBalance}
              />
            )}

            <PaymentAmountField
              value={formData.amount}
              onChange={(e) => {
                const value = e.target.value === '' ? '' : parseFloat(e.target.value) || '';
                setFormData((prev) => ({ ...prev, amount: value }));
              }}
            />
            </PaymentFormSection>
          </PaymentFormColumn>

          <PaymentFormColumn>
            <PaymentFormSection
              title="Bank & Voucher Details"
              description="Bank account, reference, and notes"
              icon={Landmark}
            >
            <PaymentDateField
              label="Payment Date"
              value={formData.date}
              onChange={(date) => setFormData(prev => ({ ...prev, date }))}
            />

            <PaymentBankSelect
              value={formData.bank}
              onChange={(e) => setFormData(prev => ({ ...prev, bank: e.target.value }))}
              banks={banks || []}
              loading={banksLoading}
              error={banksError ? 'Error loading bank accounts' : null}
            />

            <PaymentFormField label="Transaction Reference">
                <Input
                  type="text"
                  autoComplete="off"
                  value={formData.transactionReference}
                  onChange={(e) => setFormData(prev => ({ ...prev, transactionReference: e.target.value }))}
                  className={paymentFormInputClass}
                  placeholder="Cheque no., transfer ref., etc."
                />
            </PaymentFormField>

            <PaymentFormField label="Description">
                <Input
                  type="text"
                  autoComplete="off"
                  value={formData.particular}
                  onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
                  className={paymentFormInputClass}
                  placeholder="Enter payment description..."
                />
            </PaymentFormField>

            <PaymentFormField label="Notes">
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="input w-full min-h-[6rem] resize-none rounded-lg border-slate-200 shadow-sm"
                  placeholder="Additional notes..."
                />
            </PaymentFormField>
            </PaymentFormSection>
          </PaymentFormColumn>
        </PaymentFormGrid>

          {/* Action Buttons */}
          <PaymentFormActions
            onReset={resetForm}
            onSubmit={handleCreate}
            isSubmitting={creating}
            submitLabel="Save Payment"
            submittingLabel="Saving..."
          />
      </PaymentFormCard>

      {/* Filters */}
      <FiltersCard>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Date Range */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <DateFilter
                startDate={filters.fromDate}
                endDate={filters.toDate}
                onDateChange={(start, end) => {
                  handleFilterChange('fromDate', start || '');
                  handleFilterChange('toDate', end || '');
                }}
                compact={true}
                showPresets={true}
              />
            </div>

            {/* Voucher Code Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voucher Code
              </label>
              <Input
                type="text"
                autoComplete="off"
                placeholder="Contains..."
                value={filters.voucherCode}
                onChange={(e) => handleFilterChange('voucherCode', e.target.value)}
              />
            </div>

            {/* Amount Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <Input
                type="number"
                autoComplete="off"
                placeholder="Equals..."
                value={filters.amount}
                onChange={(e) => handleFilterChange('amount', e.target.value)}
              />
            </div>

            {/* Particular Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Particular
              </label>
              <Input
                type="text"
                autoComplete="off"
                placeholder="Contains..."
                value={filters.particular}
                onChange={(e) => handleFilterChange('particular', e.target.value)}
              />
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <Button
                onClick={() => refetch()}
                variant="default"
                size="default"
                className="w-full flex items-center justify-center gap-2"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </Button>
            </div>
          </div>
      </FiltersCard>

      {/* Results */}
      <div className="card">
        <ListResultsHeader
          title="Bank Payments"
          fromDate={filters.fromDate}
          toDate={filters.toDate}
          formatDate={formatDate}
          recordCount={paginationInfo.totalItems || 0}
          onRefresh={() => refetch()}
          refreshing={isLoading}
        />
        <div className="card-content p-0">
          <DataStateMessage
            isLoading={isLoading}
            error={error}
            isEmpty={bankPayments.length === 0}
            loadingLabel="Loading bank payments..."
            errorPrefix="Error loading bank payments"
            emptyLabel="No bank payments found for the selected criteria."
          >
            <>
              {/* Table */}
              <div className="table-scroll">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <SortableTableHeader
                        label="Date"
                        sortKey="date"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        label="Voucher Code"
                        sortKey="voucherCode"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        label="Amount"
                        sortKey="amount"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Particular
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bank Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Supplier/Customer/Expense
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bankPayments.map((payment, index) => (
                      <tr
                        key={payment._id}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(payment.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {payment.voucherCode}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {Math.round(payment.amount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {payment.particular}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {resolveBankInfo(payment) ? (
                            <div>
                              <div className="font-medium">{resolveBankInfo(payment).bankName}</div>
                              <div className="text-gray-500 text-xs">{resolveBankInfo(payment).accountNumber}</div>
                            </div>
                          ) : (
                            payment.bankAccount || payment.bankName || payment.bank_name || '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {payment.supplier ? (
                            <div>
                              <div className="font-medium">
                                {getSupplierDisplayName(payment.supplier, 'Unknown Supplier')}
                              </div>
                              <div className="text-gray-500 text-xs">Supplier</div>
                            </div>
                          ) : payment.customer ? (
                            <div>
                              <div className="font-medium">
                                {getCustomerDisplayName(payment.customer, payment.customer?.email || 'Unknown Customer')}
                              </div>
                              <div className="text-gray-500 text-xs">Customer</div>
                            </div>
                          ) : payment.paymentType === 'expense' ? (
                            <div>
                              <div className="font-medium text-orange-600">Expense</div>
                              <div className="text-gray-500 text-xs">{payment.particular || 'N/A'}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <RowActionButtons
                            onPrint={() => handlePrint(payment)}
                            onView={() => handleView(payment)}
                            onEdit={() => handleEdit(payment)}
                            onDelete={() => handleDelete(payment)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          </DataStateMessage>
        </div>
      </div>



      {/* Payment print modal – dedicated layout for payments only */}
      <ReceiptPaymentPrintModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setPrintData(null);
        }}
        documentTitle="Bank Payment"
        receiptData={printData}
      />

      {/* Edit Modal */}
      {showEditModal && (
        <BaseModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedPayment(null);
            resetForm();
          }}
          title="Edit Bank Payment"
          maxWidth="md"
          variant="centered"
          contentClassName="p-5"
        >
          <div className="space-y-4">
            <PaymentPartyTypeRadio
              label="Payment Type"
              value={paymentType}
              onChange={setPaymentType}
              options={[
                { value: 'supplier', label: 'Supplier' },
                { value: 'customer', label: 'Customer' },
                { value: 'expense', label: 'Expense' },
              ]}
              onOptionChange={(type) => {
                if (type === 'supplier') {
                  setSelectedCustomer(null);
                  setCustomerSearchTerm('');
                  setSelectedExpenseAccount(null);
                  setExpenseSearchTerm('');
                  setFormData((prev) => ({ ...prev, customer: '', particular: '' }));
                  return;
                }
                if (type === 'customer') {
                  setSelectedSupplier(null);
                  setSupplierSearchTerm('');
                  setSelectedExpenseAccount(null);
                  setExpenseSearchTerm('');
                  setFormData((prev) => ({ ...prev, supplier: '', particular: '' }));
                  return;
                }
                setSelectedSupplier(null);
                setSelectedCustomer(null);
                setSupplierSearchTerm('');
                setCustomerSearchTerm('');
                setFormData((prev) => ({ ...prev, supplier: '', customer: '' }));
              }}
            />

            {paymentType === 'supplier' && (
              <PaymentSupplierField
                suppliers={suppliers}
                selectedSupplier={selectedSupplier}
                onSelect={handleSupplierSelect}
                onSearch={handleSupplierSearch}
                searchValue={supplierSearchTerm}
                loading={suppliersLoading || suppliersFetching}
                canViewBalance={canViewSupplierBalance}
                canViewPhone={canViewSupplierPhone}
              />
            )}

            {paymentType === 'customer' && (
              <PaymentCustomerField
                customers={customers}
                selectedCustomer={selectedCustomer}
                onSelect={handleCustomerSelect}
                onSearch={handleCustomerSearch}
                searchValue={customerSearchTerm}
                loading={customersLoading || customersFetching}
                canViewBalance={canViewCustomerBalance}
              />
            )}

            {paymentType === 'expense' && (
              <PaymentExpenseAccountField
                label="Expense Description"
                required
                accounts={expenseAccounts || []}
                selectedAccount={selectedExpenseAccount}
                onSelect={handleExpenseAccountSelect}
                onSearch={handleExpenseSearch}
                searchValue={expenseSearchTerm}
                placeholder="Search expense account..."
              />
            )}

            <PaymentDateField
              label="Date"
              value={formData.date}
              onChange={(date) => setFormData(prev => ({ ...prev, date }))}
            />
            <FormField label="Bank Account">
              <select
                value={formData.bank}
                onChange={(e) => setFormData(prev => ({ ...prev, bank: e.target.value }))}
                className="input w-full h-10"
              >
                <option value="">Select bank account...</option>
                {banks?.map((bank) => (
                  <option key={bank._id} value={bank._id}>
                    {bank.bankName} - {bank.accountNumber}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Amount" required>
              <Input
                type="number"
                autoComplete="off"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => {
                  const value = e.target.value === '' ? '' : parseFloat(e.target.value) || '';
                  setFormData(prev => ({ ...prev, amount: value }));
                }}
                className="h-10"
                placeholder="0.00"
                required
              />
            </FormField>
            <FormField label="Transaction Reference">
              <Input
                type="text"
                autoComplete="off"
                value={formData.transactionReference}
                onChange={(e) => setFormData(prev => ({ ...prev, transactionReference: e.target.value }))}
                className="h-10"
                placeholder="Enter reference..."
              />
            </FormField>
            <FormField label="Particular">
              <textarea
                value={formData.particular}
                onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
                className="input w-full"
                rows="3"
                placeholder="Enter transaction details..."
                required
              />
            </FormField>
            <FormField label="Notes (Optional)">
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="input w-full"
                rows="2"
                placeholder="Additional notes..."
              />
            </FormField>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
                <Button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedPayment(null);
                    resetForm();
                  }}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={updating}
                  variant="default"
                >
                  {updating ? 'Updating...' : 'Update'}
                </Button>
              </div>
        </BaseModal>
      )}

      {/* View Modal */}
      {showViewModal && selectedPayment && (
        <BaseModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedPayment(null);
          }}
          title="Bank Payment Details"
          maxWidth="md"
          variant="centered"
          contentClassName="p-5"
        >
          <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-gray-500">Voucher Code:</span>
                  <span className="text-gray-900">{selectedPayment.voucherCode}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-gray-500">Date:</span>
                  <span className="text-gray-900">{formatDate(selectedPayment.date)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-gray-500">Amount:</span>
                  <span className="text-gray-900 font-bold">{Math.round(selectedPayment.amount)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-gray-500">Bank:</span>
                  <span className="text-gray-900">{resolveBankInfo(selectedPayment)?.bankName || selectedPayment.bankName || selectedPayment.bank_name || '-'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-gray-500">Reference:</span>
                  <span className="text-gray-900">{selectedPayment.transactionReference || 'N/A'}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <span className="block font-medium text-gray-500 mb-1">Particular:</span>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedPayment.particular}</p>
                </div>
                {selectedPayment.supplier && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="font-medium text-gray-500">Supplier:</span>
                    <span className="text-gray-900">{selectedPayment.supplier.companyName || selectedPayment.supplier.displayName || selectedPayment.supplier.name}</span>
                  </div>
                )}
                {selectedPayment.customer && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="font-medium text-gray-500">Customer:</span>
                    <span className="text-gray-900">{getCustomerDisplayName(selectedPayment.customer, '—')}</span>
                  </div>
                )}
                {selectedPayment.expenseAccount && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="font-medium text-gray-500">Expense Account:</span>
                    <span className="text-gray-900">{selectedPayment.expenseAccount.accountName}</span>
                  </div>
                )}
                {selectedPayment.notes && (
                  <div className="border-t pt-2 mt-2">
                    <span className="block font-medium text-gray-500 mb-1">Notes:</span>
                    <p className="text-sm text-gray-900 italic">{selectedPayment.notes}</p>
                  </div>
                )}
                <div className="border-t pt-2 mt-2 grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <span>Created By:</span>
                  <span>{selectedPayment.createdBy?.prefix} {selectedPayment.createdBy?.firstName}</span>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <Button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedPayment(null);
                  }}
                  variant="secondary"
                  className="w-full"
                >
                  Close
                </Button>
              </div>
        </BaseModal>
      )}

      <DeleteConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        itemName={deleteConfirmation.message?.match(/"([^"]*)"/)?.[1] || ''}
        itemType="Bank Payment"
        isLoading={deleteConfirmation.isLoading}
      />
    </PageLayout>
  );
};

export default BankPayments;
