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
import FormField from '../components/FormField';
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
import { PageHeader } from '../components/layout/PageHeader';
import { FormActionsFooter } from '../components/layout/FormActionsFooter';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';


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
    { isActive: true },
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

  const handleCustomerSelect = (customerId) => {
    const customer = customers?.find(c => (c.id || c._id) === customerId);
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customer: customerId }));
    setCustomerSearchTerm(customer?.businessName || customer?.business_name || customer?.displayName || customer?.name || '');
  };

  const handleCustomerSearch = (searchTerm) => {
    setCustomerSearchTerm(searchTerm);
    if (searchTerm === '') {
      setSelectedCustomer(null);
      setFormData(prev => ({ ...prev, customer: '' }));
    }
  };

  const handleSupplierSelect = (supplierId) => {
    const supplier = suppliers?.find(s => (s.id || s._id) === supplierId);
    setSelectedSupplier(supplier);
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
      setCustomerSearchTerm(receipt.customer.displayName || receipt.customer.businessName || receipt.customer.name || '');
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
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Bank Receipts" />

      {/* Bank Receipt Form */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-base sm:text-lg font-medium text-gray-900">Receipt Details</h3>
        </div>
        <div className="card-content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Payment Type Selection */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Receipt Type
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      value="customer"
                      checked={paymentType === 'customer'}
                      onChange={(e) => {
                        setPaymentType(e.target.value);
                        setSelectedSupplier(null);
                        setSupplierSearchTerm('');
                        setFormData(prev => ({ ...prev, supplier: '' }));
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Customer</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      value="supplier"
                      checked={paymentType === 'supplier'}
                      onChange={(e) => {
                        setPaymentType(e.target.value);
                        setSelectedCustomer(null);
                        setCustomerSearchTerm('');
                        setFormData(prev => ({ ...prev, customer: '' }));
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Supplier</span>
                  </label>
                </div>
              </div>

              {/* Customer Selection */}
              {paymentType === 'customer' && (
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
                            <div className="font-medium text-gray-900">{customer.businessName || customer.business_name || customer.name || 'Unknown'}</div>
                            {(customer.businessName || customer.business_name) && customer.name && (
                              <div className="text-xs text-gray-500">Contact: {customer.name}</div>
                            )}
                            {canViewCustomerBalance && hasBalance && (
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
              )}

              {/* Balance Display */}
              {selectedCustomer && canViewCustomerBalance && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Balance
                  </label>
                  <div className="space-y-1">
                    {(() => {
                      const receivables = selectedCustomer.pendingBalance || 0;
                      const advance = selectedCustomer.advanceBalance || 0;
                      const netBalance = receivables - advance;
                      const isPayable = netBalance < 0;
                      const isReceivable = netBalance > 0;
                      const hasBalance = receivables > 0 || advance > 0;

                      return hasBalance ? (
                        <div className={`flex items-center justify-between px-3 py-2 rounded ${isPayable ? 'bg-red-50 border border-red-200' : isReceivable ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                          <span className={`text-sm font-medium ${isPayable ? 'text-red-700' : isReceivable ? 'text-green-700' : 'text-gray-700'}`}>
                            {isPayable ? 'Payables:' : isReceivable ? 'Receivables:' : 'Balance:'}
                          </span>
                          <span className={`text-sm font-bold ${isPayable ? 'text-red-700' : isReceivable ? 'text-green-700' : 'text-gray-700'}`}>
                            {Math.abs(netBalance).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600 text-center">
                          No balance
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Supplier Selection */}
              {paymentType === 'supplier' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Supplier
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={supplierSearchTerm}
                      onChange={(e) => handleSupplierSearch(e.target.value)}
                      className="w-full pr-10"
                      placeholder="Search or select supplier..."
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  {supplierSearchTerm && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                      {(suppliers || []).map((supplier) => (
                        <div
                          key={supplier.id || supplier._id}
                          onClick={() => {
                            handleSupplierSelect(supplier.id || supplier._id);
                            setSupplierSearchTerm(supplier.companyName || supplier.name || '');
                          }}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{supplier.companyName || supplier.name || 'Unknown'}</div>
                          {canViewSupplierPhone && supplier.phone && (
                            <div className="text-sm text-gray-500">Phone: {supplier.phone}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Supplier Balance Display */}
              {paymentType === 'supplier' && selectedSupplier && canViewSupplierBalance && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Balance
                  </label>
                  <div className="space-y-1">
                    {selectedSupplier.pendingBalance > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 bg-red-50 border border-red-200 rounded">
                        <span className="text-sm font-medium text-red-700">Payables:</span>
                        <span className="text-sm font-bold text-red-700">{selectedSupplier.pendingBalance.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedSupplier.advanceBalance > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded">
                        <span className="text-sm font-medium text-green-700">Advance:</span>
                        <span className="text-sm font-bold text-green-700">{selectedSupplier.advanceBalance.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedSupplier.pendingBalance === 0 && selectedSupplier.advanceBalance === 0 && (
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600 text-center">
                        No balance
                      </div>
                    )}
                    {selectedSupplier.pendingBalance > 0 && selectedSupplier.advanceBalance > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border-2 border-blue-300 rounded">
                        <span className="text-sm font-bold text-blue-700">Net Balance:</span>
                        <span className={`text-sm font-bold ${(selectedSupplier.pendingBalance - selectedSupplier.advanceBalance) > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {(selectedSupplier.pendingBalance - selectedSupplier.advanceBalance).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount *
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
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Receipt Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Receipt Date
                </label>
                <InputWithIcon
                  icon={Calendar}
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              {/* Bank Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Account *
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
                {banksError && (
                  <p className="text-sm text-red-500 mt-1">Error loading banks</p>
                )}
                {!banksLoading && !banksError && (!banks || banks.length === 0) && (
                  <p className="text-sm text-amber-600 mt-1">No bank accounts. Add one in Settings → Banks.</p>
                )}
              </div>

              {/* Transaction Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction Reference
                </label>
                <Input
                  type="text"
                  value={formData.transactionReference}
                  onChange={(e) => setFormData(prev => ({ ...prev, transactionReference: e.target.value }))}
                  className="w-full"
                  placeholder="Enter transaction reference..."
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <Input
                  type="text"
                  value={formData.particular}
                  onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
                  className="w-full"
                  placeholder="Enter receipt description or notes..."
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full h-20 resize-none"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <FormActionsFooter
            onReset={resetForm}
            onSubmit={handleCreate}
            isSubmitting={creating}
            submitLabel="Save Receipt"
            submittingLabel="Saving..."
          />
        </div>
      </div>

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
              <div className="overflow-x-auto">
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
                              <div className="font-medium">{(receipt.customer.businessName || receipt.customer.business_name || receipt.customer.name || '').toUpperCase()}</div>
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
                            <div className="font-medium text-gray-900">{customer.businessName || customer.business_name || customer.name || 'Unknown'}</div>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Receipt Date
                  </label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full pr-10"
                    />
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>

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
          <FormField label="Date" htmlFor="edit-date">
            <Input
              id="edit-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="w-full"
            />
          </FormField>
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
                    <span className="text-gray-900">{selectedReceipt.customer.businessName || selectedReceipt.customer.business_name || selectedReceipt.customer.displayName || selectedReceipt.customer.name}</span>
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
    </div>
  );
};

export default BankReceipts;
