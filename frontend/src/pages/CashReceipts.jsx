import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Search } from 'lucide-react';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DetailRow } from '@/components/ui/detail-row';
import BaseModal from '../components/BaseModal';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, formatCurrency } from '../utils/formatters';
import { useLazyGetCustomerQuery, customersApi } from '../store/services/customersApi';
import {
  useGetCashReceiptsQuery,
  useCreateCashReceiptMutation,
  useUpdateCashReceiptMutation,
  useDeleteCashReceiptMutation,

} from '../store/services/cashReceiptsApi';
import { suppliersApi } from '../store/services/suppliersApi';
import { useDebouncedCustomerSearch } from '../hooks/useDebouncedCustomerSearch';
import { useDebouncedSupplierSearch } from '../hooks/useDebouncedSupplierSearch';
import { useAppDispatch } from '../store/hooks';
import { api } from '../store/api';
import ReceiptPaymentPrintModal from '../components/ReceiptPaymentPrintModal';
import { useGetBalanceSummaryQuery } from '../store/services/customerBalancesApi';
import { useGetBalanceSummaryQuery as useGetSupplierBalanceSummaryQuery } from '../store/services/supplierBalancesApi';
import DateFilter from '../components/DateFilter';
import PaginationControls from '../components/PaginationControls';
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
  partyIdFromSelect,
  customerSearchLabel,
  supplierSearchLabel,
} from '@/components/payments/PaymentPartyFields';
import { PageLayout } from '@/components/layout/PageLayout';


const CashReceipts = () => {
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

  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [paymentType, setPaymentType] = useState('customer'); // 'customer' or 'supplier'

  // Form state
  const [formData, setFormData] = useState({
    date: today,
    amount: '',
    particular: '',
    customer: '',
    supplier: '',
    notes: ''
  });

  // Fetch cash receipts
  const {
    data: cashReceiptsData,
    isLoading,
    error,
    refetch,
  } = useGetCashReceiptsQuery({ ...filters, ...pagination, sortConfig }, { refetchOnMountOrArgChange: true });

  const [getCustomer] = useLazyGetCustomerQuery();
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

  const viewModalCustomerId = showViewModal && selectedReceipt?.customer ? (selectedReceipt.customer.id || selectedReceipt.customer._id) : null;
  const viewModalSupplierId = showViewModal && selectedReceipt?.supplier ? (selectedReceipt.supplier.id || selectedReceipt.supplier._id) : null;
  const { data: viewCustomerBalanceData } = useGetBalanceSummaryQuery(viewModalCustomerId, { skip: !viewModalCustomerId || !!viewModalSupplierId });
  const { data: viewSupplierBalanceData } = useGetSupplierBalanceSummaryQuery(viewModalSupplierId, { skip: !viewModalSupplierId });
  const viewLedgerBalance = viewModalCustomerId
    ? (viewCustomerBalanceData?.data?.balances?.currentBalance ?? viewCustomerBalanceData?.balances?.currentBalance ?? null)
    : viewModalSupplierId
      ? (viewSupplierBalanceData?.data?.balances?.currentBalance ?? viewSupplierBalanceData?.balances?.currentBalance ?? null)
      : null;

  // Sync selectedCustomer with updated customersData when it changes (optimized - only update when balance changes)
  useEffect(() => {
    const selectedId = selectedCustomer?.id || selectedCustomer?._id;
    if (selectedId && customers && customers.length > 0) {
      const updatedCustomer = customers.find(c => (c.id || c._id) === selectedId);
      if (updatedCustomer) {
        // Check if any balance-related fields have changed
        const currentPending = parseFloat(selectedCustomer.pendingBalance || 0);
        const currentAdvance = parseFloat(selectedCustomer.advanceBalance || 0);
        const currentBalance = parseFloat(selectedCustomer.currentBalance || 0);

        const newPending = parseFloat(updatedCustomer.pendingBalance || updatedCustomer.pending_balance || 0);
        const newAdvance = parseFloat(updatedCustomer.advanceBalance || updatedCustomer.advance_balance || 0);
        const newBalance = parseFloat(updatedCustomer.currentBalance || updatedCustomer.current_balance || 0);

        // Only update if balances have actually changed to avoid unnecessary re-renders
        if (Math.abs(currentPending - newPending) > 0.001 ||
          Math.abs(currentAdvance - newAdvance) > 0.001 ||
          Math.abs(currentBalance - newBalance) > 0.001) {
          setSelectedCustomer({
            ...updatedCustomer,
            pendingBalance: newPending,
            advanceBalance: newAdvance,
            currentBalance: newBalance
          });
        }
      }
    }
  }, [customers, selectedCustomer?.id, selectedCustomer?._id]);

  // Mutations
  const [createCashReceipt, { isLoading: creating }] = useCreateCashReceiptMutation();
  const [updateCashReceipt, { isLoading: updating }] = useUpdateCashReceiptMutation();
  const [deleteCashReceipt, { isLoading: deleting }] = useDeleteCashReceiptMutation();


  // Helper functions
  const resetForm = () => {
    setFormData({
      date: getCurrentDatePakistan(),
      amount: '',
      particular: '',
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

  // Use a ref to store the fetch timer for debouncing
  const customerFetchTimerRef = useRef(null);

  const handleCustomerSelect = (customerOrId) => {
    const customerId = partyIdFromSelect(customerOrId);
    if (!customerId) return;
    // First set from cache for immediate UI update
    const customer =
      typeof customerOrId === 'object' && customerOrId
        ? customerOrId
        : customers?.find((c) => (c.id || c._id) === customerId);
    if (customer) {
      // Ensure balance fields are present in the cached object too
      const formattedCustomer = {
        ...customer,
        currentBalance: customer.currentBalance ?? customer.current_balance ?? 0,
        pendingBalance: customer.pendingBalance ?? customer.pending_balance ?? 0,
        advanceBalance: customer.advanceBalance ?? customer.advance_balance ?? 0
      };
      setSelectedCustomer(formattedCustomer);
      setCustomerSearchTerm(customerSearchLabel(customer));
    }
    setFormData(prev => ({ ...prev, customer: customerId }));

    // Clear any pending fetch
    if (customerFetchTimerRef.current) {
      clearTimeout(customerFetchTimerRef.current);
    }

    // Fetch fresh customer data with debounce to avoid rapid API calls
    customerFetchTimerRef.current = setTimeout(async () => {
      try {
        console.log('Fetching fresh data for customer ID:', customerId);
        const { data: response } = await getCustomer(customerId);
        console.log('Fresh customer response:', response);
        const freshCustomer = response?.customer || response?.data?.customer || response?.data || response;

        if (freshCustomer) {
          console.log('Formatting fresh customer data:', freshCustomer);
          // Ensure balance fields are present even if 0
          const formattedFreshCustomer = {
            ...freshCustomer,
            currentBalance: freshCustomer.currentBalance ?? freshCustomer.current_balance ?? 0,
            pendingBalance: freshCustomer.pendingBalance ?? freshCustomer.pending_balance ?? 0,
            advanceBalance: freshCustomer.advanceBalance ?? freshCustomer.advance_balance ?? 0
          };
          console.log('Formatted fresh customer:', formattedFreshCustomer);

          // Only update if this customer is still selected
          setSelectedCustomer(prev => {
            const prevId = prev?.id || prev?._id;
            if (prevId === customerId) {
              console.log('Updating selectedCustomer with fresh data');
              return formattedFreshCustomer;
            }
            console.log('Customer selection changed, skipping update');
            return prev;
          });
        }
      } catch (error) {
        // Silently fail - keep cached data if fetch fails
      }
    }, 200); // 200ms debounce - shorter delay for better UX
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
    if (supplier) {
      setSelectedSupplier(supplier);
      setSupplierSearchTerm(supplierSearchLabel(supplier));
    }
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
    // Clean up form data - remove empty strings and only send fields with values
    const cleanedData = {
      date: formData.date || getCurrentDatePakistan(),
      amount: parseFloat(formData.amount) || 0,
      particular: formData.particular || undefined,
      notes: formData.notes || undefined,
      paymentMethod: 'cash'
    };

    // Only include customer or supplier if they have values (not empty strings)
    if (paymentType === 'customer' && formData.customer) {
      cleanedData.customer = formData.customer;
    } else if (paymentType === 'supplier' && formData.supplier) {
      cleanedData.supplier = formData.supplier;
    }

    createCashReceipt(cleanedData)
      .unwrap()
      .then(() => {
        resetForm();
        showSuccessToast('Cash receipt created successfully');
        refetch();

        // Immediately update customer/supplier balance without waiting for refetch
        if (paymentType === 'customer' && formData.customer && selectedCustomer) {
          const receiptAmount = parseFloat(cleanedData.amount) || 0;
          // Update selected customer balance optimistically
          setSelectedCustomer(prev => {
            if (!prev) return prev;
            const newAdvanceBalance = (prev.advanceBalance || 0) + receiptAmount;
            const newCurrentBalance = (prev.currentBalance || 0) - receiptAmount;
            return { ...prev, advanceBalance: newAdvanceBalance, currentBalance: newCurrentBalance };
          });

          if (api.util?.setQueryData) {
            try {
              dispatch(api.util.setQueryData(['getCustomer', formData.customer], (oldData) => {
                if (!oldData) return oldData;
                const customer = oldData?.data?.customer || oldData?.customer || oldData?.data || oldData;
                const newAdvanceBalance = (customer.advanceBalance || 0) + receiptAmount;
                const newCurrentBalance = (customer.currentBalance || 0) - receiptAmount;
                return {
                  ...oldData,
                  data: {
                    ...oldData.data,
                    customer: { ...customer, advanceBalance: newAdvanceBalance, currentBalance: newCurrentBalance }
                  },
                  customer: { ...customer, advanceBalance: newAdvanceBalance, currentBalance: newCurrentBalance }
                };
              }));
            } catch (error) {
              console.warn('Failed to update customer cache:', error);
            }
          }

          invalidateCustomersList();
        } else if (paymentType === 'supplier' && formData.supplier && selectedSupplier) {
          const receiptAmount = parseFloat(cleanedData.amount) || 0;
          // Update selected supplier balance optimistically
          setSelectedSupplier(prev => {
            if (!prev) return prev;
            const newAdvanceBalance = (prev.advanceBalance || 0) + receiptAmount;
            const newCurrentBalance = (prev.currentBalance || 0) + receiptAmount;
            return { ...prev, advanceBalance: newAdvanceBalance, currentBalance: newCurrentBalance };
          });

          invalidateSuppliersList();
        }
      })
      .catch((error) => {
        showErrorToast(handleApiError(error));
      });
  };

  const handleUpdate = () => {
    // Clean up form data - remove empty strings and only send fields with values
    const cleanedData = {
      date: formData.date,
      amount: parseFloat(formData.amount) || 0,
      particular: formData.particular || undefined,
      notes: formData.notes || undefined
    };

    // Only include customer or supplier if they have values (not empty strings)
    if (paymentType === 'customer' && formData.customer) {
      cleanedData.customer = formData.customer;
    } else if (paymentType === 'supplier' && formData.supplier) {
      cleanedData.supplier = formData.supplier;
    }

    const oldAmount = selectedReceipt?.amount || 0;
    const newAmount = parseFloat(cleanedData.amount) || 0;
    const amountDifference = newAmount - oldAmount;

    updateCashReceipt({ id: (selectedReceipt.id || selectedReceipt._id), ...cleanedData })
      .unwrap()
      .then(() => {
        setShowEditModal(false);
        setSelectedReceipt(null);
        resetForm();
        showSuccessToast('Cash receipt updated successfully');
        refetch();

        // Immediately update customer/supplier balance without waiting for refetch
        if (paymentType === 'customer' && formData.customer && selectedCustomer && amountDifference !== 0) {
          // Update selected customer balance optimistically (add the difference)
          setSelectedCustomer(prev => {
            if (!prev) return prev;
            const newAdvanceBalance = (prev.advanceBalance || 0) + amountDifference;
            const newCurrentBalance = (prev.currentBalance || 0) - amountDifference;
            return { ...prev, advanceBalance: newAdvanceBalance, currentBalance: newCurrentBalance };
          });

          if (api.util?.setQueryData) {
            try {
              dispatch(api.util.setQueryData(['getCustomer', formData.customer], (oldData) => {
                if (!oldData) return oldData;
                const customer = oldData?.data?.customer || oldData?.customer || oldData?.data || oldData;
                const newAdvanceBalance = (customer.advanceBalance || 0) + amountDifference;
                const newCurrentBalance = (customer.currentBalance || 0) - amountDifference;
                return {
                  ...oldData,
                  data: {
                    ...oldData.data,
                    customer: { ...customer, advanceBalance: newAdvanceBalance, currentBalance: newCurrentBalance }
                  },
                  customer: { ...customer, advanceBalance: newAdvanceBalance, currentBalance: newCurrentBalance }
                };
              }));
            } catch (error) {
              console.warn('Failed to update customer cache:', error);
            }
          }

          invalidateCustomersList();
        } else if (paymentType === 'supplier' && formData.supplier && selectedSupplier && amountDifference !== 0) {
          // Update selected supplier balance optimistically (add the difference)
          setSelectedSupplier(prev => {
            if (!prev) return prev;
            const newAdvanceBalance = (prev.advanceBalance || 0) + amountDifference;
            const newCurrentBalance = (prev.currentBalance || 0) + amountDifference;
            return { ...prev, advanceBalance: newAdvanceBalance, currentBalance: newCurrentBalance };
          });

          invalidateSuppliersList();
        }
      })
      .catch((error) => {
        showErrorToast(handleApiError(error));
      });
  };

  const handleDelete = (receiptOrId) => {
    // Handle both receipt object and id string
    const receiptId = typeof receiptOrId === 'string' ? receiptOrId : (receiptOrId.id || receiptOrId._id);
    const receipt = typeof receiptOrId === 'object' ? receiptOrId : null;
    const receiptAmount = receipt ? (parseFloat(receipt.amount) || 0) : 0;
    const receiptCustomer = receipt?.customer?.id || receipt?.customer?._id || receipt?.customer || null;
    const receiptSupplier = receipt?.supplier?.id || receipt?.supplier?._id || receipt?.supplier || null;

    const label = receipt?.receiptNumber || receipt?.transactionReference || `${receiptId || 'this receipt'}`;
    confirmDelete(label, 'Cash Receipt', () => {
      return deleteCashReceipt(receiptId)
        .unwrap()
        .then(() => {
          showSuccessToast('Cash receipt deleted successfully');
          refetch();

          // Immediately update customer/supplier balance without waiting for refetch
          if (receiptCustomer && receiptAmount > 0) {
            // Subtract the amount from customer balance
            setSelectedCustomer(prev => {
              const prevId = prev?.id || prev?._id;
              if (prev && prevId === receiptCustomer) {
                const newAdvanceBalance = Math.max(0, (prev.advanceBalance || 0) - receiptAmount);
                const newCurrentBalance = (prev.currentBalance || 0) + receiptAmount;
                return { ...prev, advanceBalance: newAdvanceBalance, currentBalance: newCurrentBalance };
              }
              return prev;
            });

            if (api.util?.setQueryData) {
              try {
                dispatch(api.util.setQueryData(['getCustomer', receiptCustomer], (oldData) => {
                  if (!oldData) return oldData;
                  const customer = oldData?.data?.customer || oldData?.customer || oldData?.data || oldData;
                  const newAdvanceBalance = Math.max(0, (customer.advanceBalance || 0) - receiptAmount);
                  const newCurrentBalance = (customer.currentBalance || 0) + receiptAmount;
                  return {
                    ...oldData,
                    data: {
                      ...oldData.data,
                      customer: { ...customer, advanceBalance: newAdvanceBalance, currentBalance: newCurrentBalance }
                    },
                    customer: { ...customer, advanceBalance: newAdvanceBalance, currentBalance: newCurrentBalance }
                  };
                }));
              } catch (error) {
                console.warn('Failed to update customer cache:', error);
              }
            }

            invalidateCustomersList();
          } else if (receiptSupplier && receiptAmount > 0) {
            // Subtract the amount from supplier balance
            setSelectedSupplier(prev => {
              const prevId = prev?.id || prev?._id;
              if (prev && prevId === receiptSupplier) {
                const newAdvanceBalance = Math.max(0, (prev.advanceBalance || 0) - receiptAmount);
                const newCurrentBalance = (prev.currentBalance || 0) - receiptAmount;
                return { ...prev, advanceBalance: newAdvanceBalance, currentBalance: newCurrentBalance };
              }
              return prev;
            });

            invalidateSuppliersList();
          }
        })
        .catch((error) => {
          showErrorToast(handleApiError(error));
          throw error;
        });
    });
  };

  const handleEdit = (receipt) => {
    setSelectedReceipt(receipt);
    const receiptId = receipt.id || receipt._id;
    setFormData({
      date: receipt.date ? receipt.date.split('T')[0] : '',
      amount: receipt.amount || '',
      particular: receipt.particular || '',
      customer: receipt.customer?.id || receipt.customer?._id || '',
      supplier: receipt.supplier?.id || receipt.supplier?._id || '',
      notes: receipt.notes || ''
    });
    // Set payment type based on which entity is present
    const supplierId = receipt.supplier?.id || receipt.supplier?._id;
    const customerId = receipt.customer?.id || receipt.customer?._id;

    if (supplierId) {
      setPaymentType('supplier');
      setSelectedSupplier(receipt.supplier);
      setSupplierSearchTerm(receipt.supplier.companyName || receipt.supplier.businessName || receipt.supplier.displayName || receipt.supplier.name || '');
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
    } else if (customerId) {
      setPaymentType('customer');
      setSelectedCustomer(receipt.customer);
      setCustomerSearchTerm(receipt.customer.businessName || receipt.customer.business_name || receipt.customer.displayName || receipt.customer.name || '');
      setSelectedSupplier(null);
      setSupplierSearchTerm('');
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

  const cashReceipts =
    cashReceiptsData?.data?.cashReceipts ||
    cashReceiptsData?.cashReceipts ||
    cashReceiptsData?.data?.receipts ||
    cashReceiptsData?.receipts ||
    [];
  const paginationInfo = getPaginationInfo(cashReceiptsData);

  return (
    <PageLayout>
      {/* Cash Receipt Form */}
      <PaymentFormCard variant="cash-receipt">
          <PaymentFormGrid>
            <PaymentFormColumn>
              <PaymentFormSection
                title="Party & Amount"
                description="Select who paid and enter the receipt amount"
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
                  } else {
                    setSelectedCustomer(null);
                    setCustomerSearchTerm('');
                    setFormData((prev) => ({ ...prev, customer: '' }));
                  }
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
                  balance={
                    selectedCustomer.currentBalance !== undefined || selectedCustomer.current_balance !== undefined
                      ? parseFloat(selectedCustomer.currentBalance ?? selectedCustomer.current_balance)
                      : parseFloat(selectedCustomer.pendingBalance || selectedCustomer.pending_balance || 0)
                        - parseFloat(selectedCustomer.advanceBalance || selectedCustomer.advance_balance || 0)
                  }
                  pendingBalance={selectedCustomer.pendingBalance ?? selectedCustomer.pending_balance}
                  advanceBalance={selectedCustomer.advanceBalance ?? selectedCustomer.advance_balance}
                  showDetails
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
                  balance={
                    selectedSupplier.currentBalance !== undefined
                      ? selectedSupplier.currentBalance
                      : (selectedSupplier.advanceBalance || 0) - (selectedSupplier.pendingBalance || 0)
                  }
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
                title="Voucher Details"
                description="Date, description, and internal notes"
                icon={FileText}
              >
              <PaymentDateField
                label="Receipt Date"
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
          title="Cash Receipts"
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
            isEmpty={cashReceipts.length === 0}
            loadingLabel="Loading cash receipts..."
            errorPrefix="Error loading cash receipts"
            emptyLabel="No cash receipts found for the selected criteria."
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
                        Customer/Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Particular
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {cashReceipts.map((receipt, index) => {
                      const receiptId = receipt.id || receipt._id;
                      return (
                        <tr
                          key={receiptId}
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {receipt.customer
                              ? (receipt.customer.businessName || receipt.customer.business_name || receipt.customer.displayName || receipt.customer.name || `${(receipt.customer.firstName || '')} ${(receipt.customer.lastName || '')}`.trim() || 'N/A')
                              : receipt.supplier
                                ? (receipt.supplier.companyName || receipt.supplier.businessName || receipt.supplier.displayName || receipt.supplier.name || 'N/A')
                                : 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {receipt.particular}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <PaginationControls
                page={pagination.page}
                totalPages={paginationInfo.totalPages}
                totalItems={paginationInfo.totalItems}
                limit={pagination.limit}
                onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
              />
            </>
          </DataStateMessage>
        </div>
      </div>

      {/* Edit Modal */}
      <BaseModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedReceipt(null);
          resetForm();
        }}
        title="Edit Cash Receipt"
        maxWidth="md"
        variant="centered"
        contentClassName="p-5"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setSelectedReceipt(null);
                resetForm();
              }}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdate} disabled={updating} variant="default">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Particular</label>
            <Textarea
              value={formData.particular}
              onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
              className="w-full"
              rows={3}
              placeholder="Enter transaction details..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer (Optional)</label>
            <select
              value={formData.customer}
              onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
              className="input w-full"
              disabled={customersLoading || customersFetching}
            >
              <option value="">{customersLoading || customersFetching ? 'Loading customers...' : 'Select Customer'}</option>
              {customers?.map((customer) => {
                const customerId = customer.id || customer._id;
                return (
                  <option key={customerId} value={customerId}>
                    {customer.businessName || customer.business_name || customer.displayName || customer.name}{' '}
                    {customer.phone ? `(${customer.phone})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full"
              rows={2}
              placeholder="Additional notes..."
            />
          </div>
        </div>
      </BaseModal>

      {/* View Modal */}
      <BaseModal
        isOpen={showViewModal && !!selectedReceipt}
        onClose={() => {
          setShowViewModal(false);
          setSelectedReceipt(null);
        }}
        title="Cash Receipt Details"
        maxWidth="md"
        variant="centered"
        contentClassName="p-5"
        footer={
          <div className="flex justify-end w-full">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowViewModal(false);
                setSelectedReceipt(null);
              }}
            >
              Close
            </Button>
          </div>
        }
      >
        {selectedReceipt && (
          <div className="space-y-4">
            <DetailRow label="Voucher Code">{selectedReceipt.voucherCode}</DetailRow>
            <DetailRow label="Date">{formatDate(selectedReceipt.date)}</DetailRow>
            <DetailRow label="Amount">{formatCurrency(selectedReceipt.amount)}</DetailRow>
            {(selectedReceipt.customer || selectedReceipt.supplier) && viewLedgerBalance != null && (
              <DetailRow label="Ledger Balance">{formatCurrency(viewLedgerBalance)}</DetailRow>
            )}
            <DetailRow label="Particular">{selectedReceipt.particular}</DetailRow>
            {(selectedReceipt.customer || selectedReceipt.supplier) && (
              <DetailRow label={selectedReceipt.customer ? 'Customer' : 'Supplier'}>
                {selectedReceipt.customer
                  ? selectedReceipt.customer.businessName ||
                    selectedReceipt.customer.business_name ||
                    selectedReceipt.customer.displayName ||
                    selectedReceipt.customer.name ||
                    'N/A'
                  : selectedReceipt.supplier.companyName ||
                    selectedReceipt.supplier.businessName ||
                    selectedReceipt.supplier.displayName ||
                    selectedReceipt.supplier.name ||
                    'N/A'}
              </DetailRow>
            )}
            <DetailRow label="Payment Method">
              <span className="capitalize">{(selectedReceipt.paymentMethod ?? '').replace(/_/g, ' ')}</span>
            </DetailRow>
            {selectedReceipt.notes && <DetailRow label="Notes">{selectedReceipt.notes}</DetailRow>}
            <DetailRow label="Created By">
              {selectedReceipt.createdBy?.firstName} {selectedReceipt.createdBy?.lastName}
            </DetailRow>
          </div>
        )}
      </BaseModal>



      {/* Receipt print modal – dedicated layout for receipts only */}
      <ReceiptPaymentPrintModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setPrintData(null);
        }}
        documentTitle="Cash Receipt"
        receiptData={printData}
      />

      <DeleteConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        itemName={deleteConfirmation.message?.match(/"([^"]*)"/)?.[1] || ''}
        itemType="Cash Receipt"
        isLoading={deleteConfirmation.isLoading}
      />
    </PageLayout>
  );
};

export default CashReceipts;
