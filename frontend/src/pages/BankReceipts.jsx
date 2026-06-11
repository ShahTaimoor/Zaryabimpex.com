import React, { useState } from 'react';
import {
  Search,
  Calendar,
  Save,
  RotateCcw,
  Printer
} from 'lucide-react';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { formatDate } from '../utils/formatters';
import { getCustomerDisplayName } from '../utils/partyDisplay';
import { customersApi } from '../store/services/customersApi';
import { suppliersApi } from '../store/services/suppliersApi';
import { useAppDispatch } from '../store/hooks';
import { useDebouncedCustomerSearch } from '../hooks/useDebouncedCustomerSearch';
import { useDebouncedSupplierSearch } from '../hooks/useDebouncedSupplierSearch';
import { useGetBanksQuery } from '../store/services/banksApi';
import {
  useGetBankReceiptsQuery,
  useCreateBankReceiptMutation,
  useUpdateBankReceiptMutation,
  useDeleteBankReceiptMutation,

} from '../store/services/bankReceiptsApi';
import ReceiptPaymentPrintModal from '../components/ReceiptPaymentPrintModal';
import DateFilter from '../components/DateFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  PaymentBankSelect,
  PaymentFormActions,
  paymentFormInputClass,
} from '@/components/payments/PaymentFormLayout';
import { Users, Landmark, FileText } from 'lucide-react';
import {
  PaymentCustomerField,
  PaymentSupplierField,
  partyIdFromSelect,
  customerSearchLabel,
  supplierSearchLabel,
} from '@/components/payments/PaymentPartyFields';
import { PageLayout } from '@/components/layout/PageLayout';


const BankReceipts = () => {
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

  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [printData, setPrintData] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    date: today,
    amount: '',
    particular: '',
    bank: '',
    transactionReference: '',
    customer: '',
    supplier: '',
    notes: ''
  });

  // Customer selection state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [paymentType, setPaymentType] = useState('customer'); // 'customer' or 'supplier'

  // Fetch bank receipts
  const {
    data: bankReceiptsData,
    isLoading,
    error,
    refetch,
  } = useGetBankReceiptsQuery({ ...filters, ...pagination, sortConfig }, { refetchOnMountOrArgChange: true });

  const dispatch = useAppDispatch();

  const { customers, isLoading: customersLoading, isFetching: customersFetching } = useDebouncedCustomerSearch(
    customerSearchTerm,
    { selectedCustomer }
  );
  const { suppliers, isLoading: suppliersLoading, isFetching: suppliersFetching } = useDebouncedSupplierSearch(
    supplierSearchTerm,
    { selectedSupplier }
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
    { skip: false }
  );
  const banks = React.useMemo(() => {
    const banksList = banksData?.data?.banks || banksData?.banks || [];
    if (!Array.isArray(banksList)) {
      return [];
    }
    return banksList;
  }, [banksData]);

  // Mutations
  const [createBankReceipt, { isLoading: creating }] = useCreateBankReceiptMutation();
  const [updateBankReceipt, { isLoading: updating }] = useUpdateBankReceiptMutation();
  const [deleteBankReceipt, { isLoading: deleting }] = useDeleteBankReceiptMutation();


  // Helper functions
  const resetForm = () => {
    setFormData({
      date: getCurrentDatePakistan(),
      amount: '',
      particular: '',
      bank: '',
      transactionReference: '',
      customer: '',
      supplier: '',
      notes: ''
    });
    setSelectedCustomer(null);
    setSelectedSupplier(null);
    setCustomerSearchTerm('');
    setSupplierSearchTerm('');
    setPaymentType('customer');
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
    setFormData(prev => ({ ...prev, customer: customerId }));
  };

  const handleCustomerSearch = (searchTerm) => {
    setCustomerSearchTerm(searchTerm);
    if (searchTerm === '') {
      setSelectedCustomer(null);
      setFormData(prev => ({ ...prev, customer: '' }));
    }
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

  const handleSupplierSearch = (searchTerm) => {
    setSupplierSearchTerm(searchTerm);
    if (searchTerm === '') {
      setSelectedSupplier(null);
      setFormData(prev => ({ ...prev, supplier: '' }));
    }
  };


  const handleCreate = () => {
    // Validation
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      showErrorToast('Please enter a valid amount');
      return;
    }

    if (!formData.bank) {
      showErrorToast('Please select a bank account');
      return;
    }

    if (paymentType === 'customer' && !formData.customer) {
      showErrorToast('Please select a customer');
      return;
    }

    if (paymentType === 'supplier' && !formData.supplier) {
      showErrorToast('Please select a supplier');
      return;
    }

    // Clean up form data - remove empty strings and only send fields with values
    const cleanedData = {
      date: formData.date || getCurrentDatePakistan(),
      amount: parseFloat(formData.amount),
      particular: formData.particular || undefined,
      bank: formData.bank,
      transactionReference: formData.transactionReference || undefined,
      notes: formData.notes || undefined
    };

    // Only include customer or supplier if they have values (not empty strings)
    if (paymentType === 'customer' && formData.customer) {
      cleanedData.customer = formData.customer;
    } else if (paymentType === 'supplier' && formData.supplier) {
      cleanedData.supplier = formData.supplier;
    }

    createBankReceipt(cleanedData)
      .unwrap()
      .then(() => {
        resetForm();
        showSuccessToast('Bank receipt created successfully');
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
      customer: paymentType === 'customer' ? formData.customer : undefined,
      supplier: paymentType === 'supplier' ? formData.supplier : undefined,
      notes: formData.notes
    };

    updateBankReceipt({ id: selectedReceipt.id || selectedReceipt._id, ...submissionData })
      .unwrap()
      .then(() => {
        setShowEditModal(false);
        setSelectedReceipt(null);
        resetForm();
        showSuccessToast('Bank receipt updated successfully');
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

  const handleDelete = (receipt) => {
    const label = receipt?.receiptNumber || receipt?.transactionReference || `${receipt?.id || receipt?._id || 'this receipt'}`;
    confirmDelete(label, 'Bank Receipt', async () => {
      try {
        await deleteBankReceipt(receipt.id || receipt._id).unwrap();
        showSuccessToast('Bank receipt deleted successfully');
        refetch();
        if (receipt.customer) {
          invalidateCustomersList();
        } else if (receipt.supplier) {
          invalidateSuppliersList();
        }
      } catch (error) {
        showErrorToast(handleApiError(error));
        throw error;
      }
    });
  };

  const handleEdit = (receipt) => {
    setSelectedReceipt(receipt);
    setFormData({
      date: receipt.date ? receipt.date.split('T')[0] : today,
      amount: receipt.amount || '',
      particular: receipt.particular || '',
      bank: receipt.bank?._id || receipt.bank?.id || receipt.bank_id || receipt.bankId || '',
      transactionReference: receipt.transactionReference || '',
      customer: receipt.customer?._id || receipt.customer?.id || '',
      supplier: receipt.supplier?._id || receipt.supplier?.id || '',
      notes: receipt.notes || ''
    });

    if (receipt.customer) {
      setPaymentType('customer');
      setSelectedCustomer(receipt.customer);
      setCustomerSearchTerm(getCustomerDisplayName(receipt.customer, ''));
      setSelectedSupplier(null);
      setSupplierSearchTerm('');
    } else if (receipt.supplier) {
      setPaymentType('supplier');
      setSelectedSupplier(receipt.supplier);
      setSupplierSearchTerm(receipt.supplier.displayName || receipt.supplier.companyName || receipt.supplier.name || '');
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
    }

    setShowEditModal(true);
  };

  const handleView = (receipt) => {
    setSelectedReceipt(receipt);
    setShowViewModal(true);
  };



  const handlePrint = (receipt) => {
    setPrintData(receipt);
    setShowPrintModal(true);
  };

  const bankReceipts =
    bankReceiptsData?.data?.bankReceipts ||
    bankReceiptsData?.bankReceipts ||
    bankReceiptsData?.data?.receipts ||
    bankReceiptsData?.receipts ||
    [];
  const resolveBankInfo = (receipt) => {
    if (receipt?.bank && typeof receipt.bank === 'object') return receipt.bank;
    const bankId = receipt?.bank_id || receipt?.bankId || receipt?.bank;
    if (!bankId) return null;
    return (banks || []).find(b => (b._id || b.id) === bankId) || null;
  };
  const paginationInfo = getPaginationInfo(bankReceiptsData);

  return (
    <PageLayout>
      {/* Bank Receipt Form */}
      <PaymentFormCard variant="bank-receipt">
          <PaymentFormGrid>
            <PaymentFormColumn>
              <PaymentFormSection
                title="Party & Amount"
                description="Select payer and receipt amount"
                icon={Users}
              >
              <PaymentPartyTypeRadio
                label="Receipt Type"
                value={paymentType}
                onChange={setPaymentType}
                onOptionChange={(type) => {
                  if (type === 'customer') {
                    setSelectedSupplier(null);
                    setSupplierSearchTerm('');
                    setFormData((prev) => ({ ...prev, supplier: '' }));
                    return;
                  }
                  setSelectedCustomer(null);
                  setCustomerSearchTerm('');
                  setFormData((prev) => ({ ...prev, customer: '' }));
                }}
              />

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

              {selectedCustomer && canViewCustomerBalance && (
                <PaymentBalancePanel
                  balance={(selectedCustomer.pendingBalance || 0) - (selectedCustomer.advanceBalance || 0)}
                  pendingBalance={selectedCustomer.pendingBalance}
                  advanceBalance={selectedCustomer.advanceBalance}
                />
              )}

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

              {paymentType === 'supplier' && selectedSupplier && canViewSupplierBalance && (
                <PaymentBalancePanel
                  balance={(selectedSupplier.pendingBalance || 0) - (selectedSupplier.advanceBalance || 0)}
                  pendingBalance={selectedSupplier.pendingBalance}
                  advanceBalance={selectedSupplier.advanceBalance}
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
                label="Receipt Date"
                value={formData.date}
                onChange={(date) => setFormData(prev => ({ ...prev, date }))}
              />

              <PaymentBankSelect
                value={formData.bank}
                onChange={(e) => setFormData(prev => ({ ...prev, bank: e.target.value }))}
                banks={banks || []}
                loading={banksLoading}
                error={banksError ? 'Error loading bank accounts' : null}
                emptyHint={
                  !banksLoading && !banksError && (!banks || banks.length === 0)
                    ? 'No bank accounts. Add one in Settings → Banks.'
                    : null
                }
              />

              <PaymentFormField label="Transaction Reference">
                <Input
                  type="text"
                  value={formData.transactionReference}
                  onChange={(e) => setFormData(prev => ({ ...prev, transactionReference: e.target.value }))}
                  className={paymentFormInputClass}
                  placeholder="Cheque no., transfer ref., etc."
                />
              </PaymentFormField>

              <PaymentFormField label="Description">
                <Input
                  type="text"
                  value={formData.particular}
                  onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
                  className={paymentFormInputClass}
                  placeholder="Enter receipt description..."
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
            submitLabel="Save Receipt"
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
          title="Bank Receipts"
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
            isEmpty={bankReceipts.length === 0}
            loadingLabel="Loading bank receipts..."
            errorPrefix="Error loading bank receipts"
            emptyLabel="No bank receipts found for the selected criteria."
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
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bankReceipts.map((receipt, index) => (
                      <tr
                        key={receipt._id}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(receipt.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {receipt.voucherCode}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {Math.round(receipt.amount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {receipt.particular}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {resolveBankInfo(receipt) ? (
                            <div>
                              <div className="font-medium">{resolveBankInfo(receipt).bankName}</div>
                              <div className="text-gray-500 text-xs">{resolveBankInfo(receipt).accountNumber}</div>
                            </div>
                          ) : (
                            receipt.bankAccount || receipt.bankName || receipt.bank_name || '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {receipt.customer ? (
                            <div>
                              <div className="font-medium">{getCustomerDisplayName(receipt.customer, '—')}</div>
                              <div className="text-gray-500 text-xs">{receipt.customer.email}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <RowActionButtons
                            onPrint={() => handlePrint(receipt)}
                            onView={() => handleView(receipt)}
                            onEdit={() => handleEdit(receipt)}
                            onDelete={() => handleDelete(receipt)}
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



      {/* Receipt print modal – dedicated layout for receipts only */}
      <ReceiptPaymentPrintModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setPrintData(null);
        }}
        documentTitle="Bank Receipt"
        receiptData={printData}
      />

      {/* Create Modal - Removed */}
      {false && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-4/5 max-w-4xl shadow-lg rounded-lg bg-white">
            <div className="mb-6 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">Bank Receipt Details</h3>
              <button
                onClick={() => {
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={customerSearchTerm}
                      onChange={(e) => handleCustomerSearch(e.target.value)}
                      className="w-full pr-10"
                      placeholder="Search or select customer..."
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  {customerSearchTerm && (
                    <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                      {(customers || []).map((customer) => {
                        const receivables = customer.pendingBalance || 0;
                        const advance = customer.advanceBalance || 0;
                        const netBalance = receivables - advance;
                        const isPayable = netBalance < 0;
                        const isReceivable = netBalance > 0;
                        const hasBalance = receivables > 0 || advance > 0;

                        return (
                          <div
                            key={customer.id || customer._id}
                            onClick={() => {
                              handleCustomerSelect(customer.id || customer._id);
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{getCustomerDisplayName(customer, 'Unknown')}</div>
                            {(customer.businessName || customer.business_name) && customer.name && (
                              <div className="text-xs text-gray-500">Contact: {customer.name}</div>
                            )}
                            {hasBalance && (
                              <div className={`text-sm ${isPayable ? 'text-red-600' : 'text-green-600'}`}>
                                {isPayable ? 'Payables:' : 'Receivables:'} {Math.abs(netBalance).toFixed(2)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Receivables
                  </label>
                  <Input
                    type="text"
                    value={selectedCustomer?.pendingBalance ? `${selectedCustomer.pendingBalance}` : 'No pending balance'}
                    className="w-full bg-gray-50"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Account <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.bank}
                    onChange={(e) => setFormData(prev => ({ ...prev, bank: e.target.value }))}
                    className="input w-full"
                    required
                  >
                    <option value="">Select bank account...</option>
                    {(banks || []).map((bank) => (
                      <option key={bank._id || bank.id} value={bank._id || bank.id}>
                        {bank.bankName} - {bank.accountNumber} {bank.accountName ? `(${bank.accountName})` : ''}
                      </option>
                    ))}
                  </select>
                  {banksLoading && (
                    <p className="text-sm text-gray-500 mt-1">Loading banks...</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <Textarea
                    value={formData.particular}
                    onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
                    className="w-full resize-none"
                    rows="4"
                    placeholder="Enter bank receipt description or notes..."
                    required
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <PaymentDateField
                  label="Receipt Date"
                  value={formData.date}
                  onChange={(date) => setFormData(prev => ({ ...prev, date }))}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction Reference
                  </label>
                  <Input
                    type="text"
                    value={formData.transactionReference}
                    onChange={(e) => setFormData(prev => ({ ...prev, transactionReference: e.target.value }))}
                    className="w-full"
                    placeholder="Enter transaction reference (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full resize-none"
                    rows="3"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 mt-8 pt-6 border-t border-gray-200">
              <Button
                onClick={resetForm}
                variant="outline"
                size="default"
                className="flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </Button>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="default"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Preview</span>
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating}
                  variant="default"
                  size="default"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Save className="h-4 w-4" />
                  <span>{creating ? 'Saving...' : 'Save Receipt'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      <BaseModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedReceipt(null); resetForm(); }}
        title="Edit Bank Receipt"
        maxWidth="sm"
        variant="centered"
        contentClassName="p-5"
        footer={
          <div className="flex justify-end space-x-3">
            <Button onClick={() => { setShowEditModal(false); setSelectedReceipt(null); resetForm(); }} variant="secondary">
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
          <FormField label="Bank Account" htmlFor="edit-bank">
            <select
              id="edit-bank"
              value={formData.bank}
              onChange={(e) => setFormData(prev => ({ ...prev, bank: e.target.value }))}
              className="input w-full"
            >
              <option value="">Select bank account...</option>
              {(banks || []).map((bank) => (
                <option key={bank._id || bank.id} value={bank._id || bank.id}>{bank.bankName} - {bank.accountNumber}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Amount" htmlFor="edit-amount" required>
            <Input
              id="edit-amount"
              type="number"
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
          <FormField label="Transaction Reference" htmlFor="edit-ref">
            <Input
              id="edit-ref"
              type="text"
              value={formData.transactionReference}
              onChange={(e) => setFormData(prev => ({ ...prev, transactionReference: e.target.value }))}
              className="w-full"
              placeholder="Enter reference..."
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
        isOpen={showViewModal && !!selectedReceipt}
        onClose={() => { setShowViewModal(false); setSelectedReceipt(null); }}
        title="Bank Receipt Details"
        maxWidth="sm"
        variant="centered"
        contentClassName="p-5"
        footer={
          <div className="flex justify-end">
            <Button onClick={() => { setShowViewModal(false); setSelectedReceipt(null); }} variant="secondary" className="w-full">
              Close
            </Button>
          </div>
        }
      >
        {selectedReceipt && (
          <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-gray-500">Voucher Code:</span>
                  <span className="text-gray-900">{selectedReceipt.voucherCode}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-gray-500">Date:</span>
                  <span className="text-gray-900">{formatDate(selectedReceipt.date)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-gray-500">Amount:</span>
                  <span className="text-gray-900 font-bold">{Math.round(selectedReceipt.amount)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-gray-500">Bank:</span>
                  <span className="text-gray-900">{resolveBankInfo(selectedReceipt)?.bankName || selectedReceipt.bankName || selectedReceipt.bank_name || '-'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-gray-500">Reference:</span>
                  <span className="text-gray-900">{selectedReceipt.transactionReference || 'N/A'}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <span className="block font-medium text-gray-500 mb-1">Particular:</span>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedReceipt.particular}</p>
                </div>
                {selectedReceipt.customer && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="font-medium text-gray-500">Customer:</span>
                    <span className="text-gray-900">{getCustomerDisplayName(selectedReceipt.customer, '—')}</span>
                  </div>
                )}
                {selectedReceipt.supplier && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="font-medium text-gray-500">Supplier:</span>
                    <span className="text-gray-900">{selectedReceipt.supplier.displayName || selectedReceipt.supplier.companyName || selectedReceipt.supplier.name}</span>
                  </div>
                )}
                {selectedReceipt.notes && (
                  <div className="border-t pt-2 mt-2">
                    <span className="block font-medium text-gray-500 mb-1">Notes:</span>
                    <p className="text-sm text-gray-900 italic">{selectedReceipt.notes}</p>
                  </div>
                )}
                <div className="border-t pt-2 mt-2 grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <span>Created By:</span>
                  <span>{selectedReceipt.createdBy?.prefix} {selectedReceipt.createdBy?.firstName}</span>
                </div>
          </div>
        )}
      </BaseModal>

      <DeleteConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        itemName={deleteConfirmation.message?.match(/"([^"]*)"/)?.[1] || ''}
        itemType="Bank Receipt"
        isLoading={deleteConfirmation.isLoading}
      />
    </PageLayout>
  );
};

export default BankReceipts;
