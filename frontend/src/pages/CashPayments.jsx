import React, { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  useGetCashPaymentsQuery,
  useCreateCashPaymentMutation,
  useUpdateCashPaymentMutation,
  useDeleteCashPaymentMutation,

} from '../store/services/cashPaymentsApi';
import { suppliersApi } from '../store/services/suppliersApi';
import { customersApi } from '../store/services/customersApi';
import { useDebouncedCustomerSearch } from '../hooks/useDebouncedCustomerSearch';
import { useDebouncedSupplierSearch } from '../hooks/useDebouncedSupplierSearch';
import { useGetAccountsQuery } from '../store/services/chartOfAccountsApi';
import { useAppDispatch } from '../store/hooks';
import { api } from '../store/api';
import DateFilter from '../components/DateFilter';
import BaseModal from '../components/BaseModal';
import FormField from '@/components/FormField';
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
  PaymentFormActions,
  paymentFormInputClass,
} from '@/components/payments/PaymentFormLayout';
import { Users, FileText } from 'lucide-react';
import {
  PaymentCustomerField,
  PaymentSupplierField,
  PaymentExpenseAccountField,
  partyIdFromSelect,
  customerSearchLabel,
  supplierSearchLabel,
} from '@/components/payments/PaymentPartyFields';
import { PageLayout } from '@/components/layout/PageLayout';


const CashPayments = () => {
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

  // Fetch cash payments
  const {
    data: cashPaymentsData,
    isLoading,
    error,
    refetch,
  } = useGetCashPaymentsQuery({ ...filters, ...pagination, sortConfig }, { refetchOnMountOrArgChange: true });

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

  // Fetch expense accounts from Chart of Accounts
  const { data: expenseAccountsData, isLoading: expenseAccountsLoading } = useGetAccountsQuery(
    { accountType: 'expense', isActive: 'true' },
    { refetchOnMountOrArgChange: true }
  );

  const expenseAccounts =
    expenseAccountsData?.data ||
    expenseAccountsData?.accounts ||
    expenseAccountsData ||
    [];

  // Update selected supplier when suppliers data changes
  useEffect(() => {
    const selectedId = selectedSupplier?.id || selectedSupplier?._id;
    if (selectedId && suppliers.length > 0) {
      const updatedSupplier = suppliers.find(s => (s.id || s._id) === selectedId);
      if (updatedSupplier && (
        updatedSupplier.pendingBalance !== selectedSupplier.pendingBalance ||
        updatedSupplier.advanceBalance !== selectedSupplier.advanceBalance ||
        updatedSupplier.currentBalance !== selectedSupplier.currentBalance
      )) {
        setSelectedSupplier(updatedSupplier);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliers]);

  // Update selected customer when customers data changes
  useEffect(() => {
    const selectedId = selectedCustomer?.id || selectedCustomer?._id;
    if (selectedId && customers.length > 0) {
      const updatedCustomer = customers.find(c => (c.id || c._id) === selectedId);
      if (updatedCustomer && (
        updatedCustomer.pendingBalance !== selectedCustomer.pendingBalance ||
        updatedCustomer.advanceBalance !== selectedCustomer.advanceBalance ||
        updatedCustomer.currentBalance !== selectedCustomer.currentBalance
      )) {
        setSelectedCustomer(updatedCustomer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  // Mutations
  const [createCashPayment, { isLoading: creating }] = useCreateCashPaymentMutation();
  const [updateCashPayment, { isLoading: updating }] = useUpdateCashPaymentMutation();
  const [deleteCashPayment, { isLoading: deleting }] = useDeleteCashPaymentMutation();


  // Helper functions
  const resetForm = () => {
    setFormData({
      date: getCurrentDatePakistan(),
      amount: '',
      particular: '',
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
        : suppliers?.find((s) => (s.id || s._id) === supplierId);
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
        : customers?.find((c) => (c.id || c._id) === customerId);
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
        : expenseAccounts?.find((a) => (a.id || a._id) === accountId);
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
      particular: formData.particular,
      supplier: paymentType === 'supplier' ? formData.supplier : undefined,
      customer: paymentType === 'customer' ? formData.customer : undefined,
      notes: formData.notes,
      paymentMethod: 'cash'
    };

    createCashPayment(submissionData)
      .unwrap()
      .then(() => {
        resetForm();
        showSuccessToast('Cash payment created successfully');
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
      supplier: paymentType === 'supplier' ? formData.supplier : undefined,
      customer: paymentType === 'customer' ? formData.customer : undefined,
      notes: formData.notes
    };

    updateCashPayment({ id: (selectedPayment.id || selectedPayment._id), ...submissionData })
      .unwrap()
      .then(() => {
        setShowEditModal(false);
        setSelectedPayment(null);
        resetForm();
        showSuccessToast('Cash payment updated successfully');
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
    confirmDelete(label, 'Cash Payment', async () => {
      try {
        await deleteCashPayment(payment.id || payment._id).unwrap();
        showSuccessToast('Cash payment deleted successfully');
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
    const supplierId = payment.supplier?.id || payment.supplier?._id;
    const customerId = payment.customer?.id || payment.customer?._id;

    setFormData({
      date: payment.date ? payment.date.split('T')[0] : today,
      amount: payment.amount || '',
      particular: payment.particular || '',
      supplier: supplierId || '',
      customer: customerId || '',
      notes: payment.notes || ''
    });

    if (supplierId) {
      setPaymentType('supplier');
      setSelectedSupplier(payment.supplier);
      setSupplierSearchTerm(getSupplierDisplayName(payment.supplier, ''));
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
    } else if (customerId) {
      setPaymentType('customer');
      setSelectedCustomer(payment.customer);
      setCustomerSearchTerm(getCustomerDisplayName(payment.customer, ''));
      setSelectedSupplier(null);
      setSupplierSearchTerm('');
    } else {
      setPaymentType('expense');
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

  const cashPayments =
    cashPaymentsData?.data?.cashPayments ||
    cashPaymentsData?.cashPayments ||
    cashPaymentsData?.data?.payments ||
    cashPaymentsData?.payments ||
    [];
  const paginationInfo = getPaginationInfo(cashPaymentsData);

  return (
    <PageLayout>
      {/* Cash Payment Form */}
      <PaymentFormCard variant="cash-payment">
          <PaymentFormGrid>
            <PaymentFormColumn>
              <PaymentFormSection
                title="Party & Amount"
                description="Who received the payment and how much was paid"
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
                  balance={
                    selectedSupplier.currentBalance !== undefined
                      ? selectedSupplier.currentBalance
                      : (selectedSupplier.advanceBalance || 0) - (selectedSupplier.pendingBalance || 0)
                  }
                  pendingBalance={selectedSupplier.pendingBalance}
                  advanceBalance={selectedSupplier.advanceBalance}
                />
              )}
              {paymentType === 'customer' && selectedCustomer && canViewCustomerBalance && (
                <PaymentBalancePanel
                  balance={
                    selectedCustomer.currentBalance !== undefined
                      ? selectedCustomer.currentBalance
                      : (selectedCustomer.pendingBalance || 0) - (selectedCustomer.advanceBalance || 0)
                  }
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
                title="Voucher Details"
                description="Date, description, and internal notes"
                icon={FileText}
              >
              <PaymentDateField
                label="Payment Date"
                value={formData.date}
                onChange={(date) => setFormData(prev => ({ ...prev, date }))}
              />

              <PaymentFormField label="Description">
                <Input
                  type="text"
                  autoComplete="off"
                  value={formData.particular}
                  onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
                  className={paymentFormInputClass}
                  placeholder="Enter payment description or notes..."
                />
              </PaymentFormField>

              <PaymentFormField label="Notes">
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="min-h-[6rem] resize-none rounded-lg border-slate-200 shadow-sm"
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
          title="Cash Payments"
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
            isEmpty={cashPayments.length === 0}
            loadingLabel="Loading cash payments..."
            errorPrefix="Error loading cash payments"
            emptyLabel="No cash payments found for the selected criteria."
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
                        Supplier/Customer/Expense
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {cashPayments.map((payment, index) => {
                      const paymentId = payment.id || payment._id;
                      return (
                        <tr
                          key={paymentId}
                          className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(payment.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {payment.voucherCode || payment.payment_number || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {Math.round(payment.amount)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {payment.particular}
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
                      );
                    })}
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
        documentTitle="Cash Payment"
        receiptData={printData}
      />

      {/* Edit Modal */}
      <BaseModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedPayment(null); resetForm(); }}
        title="Edit Cash Payment"
        maxWidth="sm"
        variant="centered"
        contentClassName="p-5"
        footer={
          <div className="flex justify-end space-x-3">
            <Button onClick={() => { setShowEditModal(false); setSelectedPayment(null); resetForm(); }} variant="secondary">
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updating} variant="default">
              {updating ? 'Updating...' : 'Update'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <PaymentDateField
            label="Date"
            value={formData.date}
            onChange={(date) => setFormData(prev => ({ ...prev, date }))}
          />
          <FormField label="Amount" htmlFor="edit-amount" required>
            <Input
              id="edit-amount"
              type="number"
              autoComplete="off"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => {
                const value = e.target.value === '' ? '' : parseFloat(e.target.value) || '';
                setFormData(prev => ({ ...prev, amount: value }));
              }}
              className="w-full"
              placeholder="0.00"
              required
            />
          </FormField>
          <FormField label="Particular" htmlFor="edit-particular" required>
            <Textarea
              id="edit-particular"
              value={formData.particular}
              onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
              className="w-full"
              rows={3}
              placeholder="Enter transaction details..."
              required
            />
          </FormField>
          <FormField label={`${paymentType === 'supplier' ? 'Supplier' : 'Customer'} (Optional)`} htmlFor="edit-party">
            <select
              id="edit-party"
              value={paymentType === 'supplier' ? formData.supplier : formData.customer}
              onChange={(e) => setFormData(prev => ({ ...prev, [paymentType === 'supplier' ? 'supplier' : 'customer']: e.target.value }))}
              className="input w-full"
              disabled={paymentType === 'supplier' ? suppliersLoading : customersLoading}
            >
              <option value="">
                {paymentType === 'supplier' ? (suppliersLoading ? 'Loading suppliers...' : 'Select Supplier') : (customersLoading ? 'Loading customers...' : 'Select Customer')}
              </option>
              {paymentType === 'supplier'
                ? suppliers?.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{getSupplierDisplayName(s, 'Supplier')}</option>)
                : customers?.map((c) => <option key={c.id || c._id} value={c.id || c._id}>{getCustomerDisplayName(c, 'Customer')}</option>)
              }
            </select>
          </FormField>
          <FormField label="Notes (Optional)" htmlFor="edit-notes">
            <Textarea
              id="edit-notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full"
              rows={2}
              placeholder="Additional notes..."
            />
          </FormField>
        </div>
      </BaseModal>

      {/* View Modal */}
      <BaseModal
        isOpen={showViewModal && !!selectedPayment}
        onClose={() => { setShowViewModal(false); setSelectedPayment(null); }}
        title="Cash Payment Details"
        maxWidth="sm"
        variant="centered"
        contentClassName="p-5"
        footer={
          <div className="flex justify-end">
            <Button onClick={() => { setShowViewModal(false); setSelectedPayment(null); }} variant="secondary" className="w-full">
              Close
            </Button>
          </div>
        }
      >
        {selectedPayment && (
          <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Voucher Code
                  </label>
                  <p className="text-sm text-gray-900">{selectedPayment.voucherCode || selectedPayment.payment_number || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <p className="text-sm text-gray-900">{formatDate(selectedPayment.date)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <p className="text-sm text-gray-900">{Math.round(selectedPayment.amount)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Particular
                  </label>
                  <p className="text-sm text-gray-900">{selectedPayment.particular}</p>
                </div>
                {selectedPayment.supplier && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Supplier
                    </label>
                    <p className="text-sm text-gray-900">{getSupplierDisplayName(selectedPayment.supplier, '—')}</p>
                  </div>
                )}
                {selectedPayment.customer && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer
                    </label>
                    <p className="text-sm text-gray-900">{getCustomerDisplayName(selectedPayment.customer, '—')}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <p className="text-sm text-gray-900 capitalize">{selectedPayment.paymentMethod?.replace('_', ' ') || 'Cash'}</p>
                </div>
                {selectedPayment.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <p className="text-sm text-gray-900">{selectedPayment.notes}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Created By
                  </label>
                  <p className="text-sm text-gray-900">
                    {selectedPayment.createdBy?.firstName} {selectedPayment.createdBy?.lastName}
                  </p>
                </div>
              </div>
        )}
      </BaseModal>

      <DeleteConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        itemName={deleteConfirmation.message?.match(/"([^"]*)"/)?.[1] || ''}
        itemType="Cash Payment"
        isLoading={deleteConfirmation.isLoading}
      />
    </PageLayout>
  );
};

export default CashPayments;
