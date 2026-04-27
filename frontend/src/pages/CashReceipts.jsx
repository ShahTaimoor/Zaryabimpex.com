import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  ArrowUpDown,
  RotateCcw,
  Printer,
  Save
} from 'lucide-react';
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
import { getCurrentDatePakistan, formatDateForInput } from '../utils/dateUtils';


const CashReceipts = () => {
  const today = getCurrentDatePakistan();
  // State for filters and pagination
  const [filters, setFilters] = useState({
    fromDate: today,
    toDate: today,
    voucherCode: '',
    amount: '',
    particular: ''
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50
  });

  const [sortConfig, setSortConfig] = useState({
    key: 'date',
    direction: 'desc'
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
  const [customerDropdownIndex, setCustomerDropdownIndex] = useState(-1);
  const [supplierDropdownIndex, setSupplierDropdownIndex] = useState(-1);
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
    setCustomerDropdownIndex(-1);
    setSupplierDropdownIndex(-1);
    setPaymentType('customer');
  };

  // Use a ref to store the fetch timer for debouncing
  const customerFetchTimerRef = useRef(null);

  const handleCustomerSelect = (customerId) => {
    // First set from cache for immediate UI update
    const customer = customers?.find(c => (c.id || c._id) === customerId);
    if (customer) {
      // Ensure balance fields are present in the cached object too
      const formattedCustomer = {
        ...customer,
        currentBalance: customer.currentBalance ?? customer.current_balance ?? 0,
        pendingBalance: customer.pendingBalance ?? customer.pending_balance ?? 0,
        advanceBalance: customer.advanceBalance ?? customer.advance_balance ?? 0
      };
      setSelectedCustomer(formattedCustomer);
      setCustomerSearchTerm(customer.businessName || customer.business_name || customer.displayName || customer.name || '');
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
    setCustomerDropdownIndex(0); // Default to first result
    if (searchTerm === '') {
      setSelectedCustomer(null);
      setFormData(prev => ({ ...prev, customer: '' }));
    }
  };

  const handleCustomerKeyDown = (e) => {
    const filteredCustomers = customers || [];

    if (!customerSearchTerm || filteredCustomers.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setCustomerDropdownIndex(prev =>
          prev < filteredCustomers.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setCustomerDropdownIndex(prev =>
          prev > 0 ? prev - 1 : filteredCustomers.length - 1
        );
        break;

      case 'Enter':
        e.preventDefault();
        if (customerDropdownIndex >= 0 && customerDropdownIndex < filteredCustomers.length) {
          const customer = filteredCustomers[customerDropdownIndex];
          handleCustomerSelect(customer.id || customer._id);
          setCustomerSearchTerm(customer.businessName || customer.business_name || customer.displayName || customer.name || '');
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

  const handleSupplierSelect = (supplierId) => {
    const supplier = suppliers?.find(s => (s.id || s._id) === supplierId);
    if (supplier) {
      setSelectedSupplier(supplier);
      setSupplierSearchTerm(supplier.companyName || supplier.name || '');
    }
    setFormData(prev => ({ ...prev, supplier: supplierId, customer: '' }));
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
  };

  const handleSupplierSearch = (searchTerm) => {
    setSupplierSearchTerm(searchTerm);
    setSupplierDropdownIndex(0); // Default to first result
    if (searchTerm === '') {
      setSelectedSupplier(null);
      setFormData(prev => ({ ...prev, supplier: '' }));
    }
  };

  const handleSupplierKeyDown = (e) => {
    const filteredSuppliers = (suppliers || []).filter(supplier =>
      (supplier.companyName || supplier.name || '').toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
      (supplier.phone || '').includes(supplierSearchTerm)
    );

    if (!supplierSearchTerm || filteredSuppliers.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSupplierDropdownIndex(prev =>
          prev < filteredSuppliers.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSupplierDropdownIndex(prev =>
          prev > 0 ? prev - 1 : filteredSuppliers.length - 1
        );
        break;

      case 'Enter':
        e.preventDefault();
        if (supplierDropdownIndex >= 0 && supplierDropdownIndex < filteredSuppliers.length) {
          const supplier = filteredSuppliers[supplierDropdownIndex];
          handleSupplierSelect(supplier.id || supplier._id);
          setSupplierSearchTerm(supplier.companyName || supplier.name || '');
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

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
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

    if (window.confirm('Are you sure you want to delete this cash receipt?')) {
      deleteCashReceipt(receiptId)
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
        });
    }
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
  const paginationInfo =
    cashReceiptsData?.data?.pagination ||
    cashReceiptsData?.pagination ||
    {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-3xl font-bold text-gray-900 truncate">Cash Receipts</h1>
          <p className="hidden sm:block text-sm sm:text-base text-gray-600 mt-1">Manage and view all cash receipt transactions</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto">

          <Button
            onClick={resetForm}
            variant="default"
            size="default"
            className="flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Receipt</span>
          </Button>
        </div>
      </div>

      {/* Cash Receipt Form */}
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
                      onKeyDown={handleCustomerKeyDown}
                      className="w-full pr-10"
                      placeholder="Search or select customer..."
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  {customerSearchTerm && (
                    <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                      {(customers || []).map((customer, index) => {
                        const customerId = customer.id || customer._id;
                        const currentBalance = customer.currentBalance !== undefined
                          ? parseFloat(customer.currentBalance)
                          : (parseFloat(customer.pendingBalance || 0) - parseFloat(customer.advanceBalance || 0));
                        const isPayable = currentBalance < -0.001;
                        const isReceivable = currentBalance > 0.001;
                        const hasBalance = Math.abs(currentBalance) > 0.001;

                        return (
                          <div
                            key={customerId}
                            onClick={() => {
                              handleCustomerSelect(customerId);
                              setCustomerSearchTerm(customer.businessName || customer.business_name || customer.displayName || customer.name || '');
                              setCustomerDropdownIndex(-1);
                            }}
                            className={`px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${customerDropdownIndex === index ? 'bg-blue-50' : ''
                              }`}
                          >
                            <div className="flex justify-between items-center">
                              <div className="font-medium text-gray-900">
                                {customer.businessName || customer.business_name || customer.name || 'Unknown'}
                              </div>
                            </div>
                            {(customer.businessName || customer.business_name) && customer.name && (
                              <div className="text-xs text-gray-500">Contact: {customer.name}</div>
                            )}
                            {hasBalance && (
                              <div className={`text-sm ${isPayable ? 'text-red-600' : 'text-green-600'}`}>
                                {isPayable ? 'Payables:' : 'Receivables:'} {Math.abs(currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              {selectedCustomer && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Balance
                  </label>
                  <div className="space-y-1">
                    {(() => {
                      const pending = parseFloat(selectedCustomer.pendingBalance || selectedCustomer.pending_balance || 0);
                      const advance = parseFloat(selectedCustomer.advanceBalance || selectedCustomer.advance_balance || 0);
                      const currentBalance = selectedCustomer.currentBalance !== undefined || selectedCustomer.current_balance !== undefined
                        ? parseFloat(selectedCustomer.currentBalance ?? selectedCustomer.current_balance)
                        : (pending - advance);

                      // For customers: 
                      // Positive balance = Receivables (they owe us)
                      // Negative balance = Payables (we owe them / advance)
                      const isPayable = currentBalance < -0.001;
                      const isReceivable = currentBalance > 0.001;
                      const hasBalance = Math.abs(currentBalance) > 0.001;

                      return hasBalance ? (
                        <div className={`flex items-center justify-between px-3 py-2 rounded ${isPayable ? 'bg-red-50 border border-red-200' : isReceivable ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                          <span className={`text-sm font-medium ${isPayable ? 'text-red-700' : isReceivable ? 'text-green-700' : 'text-gray-700'}`}>
                            {isPayable ? 'Payables:' : isReceivable ? 'Receivables:' : 'Balance:'}
                          </span>
                          <span className={`text-sm font-bold ${isPayable ? 'text-red-700' : isReceivable ? 'text-green-700' : 'text-gray-700'}`}>
                            {Math.abs(currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ) : (
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600 text-center flex flex-col">
                          <span>No balance</span>
                          <span className="text-[10px] text-gray-400">
                            (P: {pending.toFixed(2)},
                            A: {advance.toFixed(2)},
                            C: {currentBalance.toFixed(2)})
                          </span>
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
                      onKeyDown={handleSupplierKeyDown}
                      className="w-full pr-10"
                      placeholder="Search or select supplier..."
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  {supplierSearchTerm && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                      {(suppliers || []).filter(supplier =>
                        (supplier.companyName || supplier.name || '').toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
                        (supplier.phone || '').includes(supplierSearchTerm)
                      ).map((supplier, index) => {
                        const supplierId = supplier.id || supplier._id;
                        return (
                          <div
                            key={supplierId}
                            onClick={() => {
                              handleSupplierSelect(supplierId);
                              setSupplierSearchTerm(supplier.companyName || supplier.name || '');
                              setSupplierDropdownIndex(-1);
                            }}
                            className={`px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${supplierDropdownIndex === index ? 'bg-blue-50' : ''
                              }`}
                          >
                            <div className="font-medium text-gray-900">{supplier.companyName || supplier.name || 'Unknown'}</div>
                            {supplier.phone && (
                              <div className="text-sm text-gray-500">Phone: {supplier.phone}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Supplier Balance Display */}
              {paymentType === 'supplier' && selectedSupplier && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Balance
                  </label>
                  <div className="space-y-1">
                    {(() => {
                      const currentBalance = selectedSupplier.currentBalance !== undefined
                        ? selectedSupplier.currentBalance
                        : ((selectedSupplier.advanceBalance || 0) - (selectedSupplier.pendingBalance || 0));
                      const isPayable = currentBalance < 0;
                      const isReceivable = currentBalance > 0;
                      const hasBalance = Math.abs(currentBalance) > 0.01;

                      return hasBalance ? (
                        <div className={`flex items-center justify-between px-3 py-2 rounded ${isPayable ? 'bg-red-50 border border-red-200' : isReceivable ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                          <span className={`text-sm font-medium ${isPayable ? 'text-red-700' : isReceivable ? 'text-green-700' : 'text-gray-700'}`}>
                            {isPayable ? 'Payables:' : isReceivable ? 'Receivables:' : 'Balance:'}
                          </span>
                          <span className={`text-sm font-bold ${isPayable ? 'text-red-700' : isReceivable ? 'text-green-700' : 'text-gray-700'}`}>
                            {Math.abs(currentBalance).toFixed(2)}
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

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount *
                </label>
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
                <div className="relative">
                  <Input
                    type="date"
                    autoComplete="off"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full pr-10"
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <Input
                  type="text"
                  autoComplete="off"
                  value={formData.particular}
                  onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
                  className="w-full"
                  placeholder="Enter receipt description..."
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
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <Button
              onClick={resetForm}
              variant="outline"
              size="default"
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
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

      {/* Filters */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          </div>
        </div>
        <div className="card-content">
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
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <div className="card-header">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 leading-tight">
              Cash Receipts
              <span className="block sm:inline sm:ml-2 text-xs sm:text-sm font-normal text-gray-500 mt-1 sm:mt-0">
                From: {formatDate(filters.fromDate)} To: {formatDate(filters.toDate)}
              </span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                <span className="font-semibold text-gray-700">
                  {paginationInfo.totalItems || 0}
                </span>{' '}
                records
              </span>
              <button
                onClick={() => refetch()}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="card-content p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-gray-500">Loading cash receipts...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              <p>Error loading cash receipts: {handleApiError(error).message}</p>
            </div>
          ) : cashReceipts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No cash receipts found for the selected criteria.</p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('date')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Date</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('voucherCode')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Voucher Code</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('amount')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Amount</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
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
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handlePrint(receipt)}
                                className="text-green-600 hover:text-green-900"
                                title="Print"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleView(receipt)}
                                className="text-blue-600 hover:text-blue-900"
                                title="View"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {(
                                <>
                                  <button
                                    onClick={() => handleEdit(receipt)}
                                    className="text-indigo-600 hover:text-indigo-900"
                                    title="Edit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(receipt)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
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
          )}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="w-full"
            />
          </div>
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
    </div>
  );
};

export default CashReceipts;
