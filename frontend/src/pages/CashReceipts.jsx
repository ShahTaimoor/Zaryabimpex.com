import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  Download,
  RefreshCw,
  ArrowUpDown,
  RotateCcw,
  Printer,
  Save
} from 'lucide-react';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { formatDate, formatCurrency } from '../utils/formatters';
import { useLazyGetCustomerQuery } from '../store/services/customersApi';
import {
  useGetCashReceiptsQuery,
  useCreateCashReceiptMutation,
  useUpdateCashReceiptMutation,
  useDeleteCashReceiptMutation,
  useExportExcelMutation,
  useExportCSVMutation,
  useExportPDFMutation,
  useExportJSONMutation,
  useDownloadFileMutation,
} from '../store/services/cashReceiptsApi';
import { useGetSuppliersQuery } from '../store/services/suppliersApi';
import { useGetCustomersQuery } from '../store/services/customersApi';
import { useAppDispatch } from '../store/hooks';
import { api } from '../store/api';
import ReceiptPaymentPrintModal from '../components/ReceiptPaymentPrintModal';
import DateFilter from '../components/DateFilter';
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

  // Fetch customers for dropdown
  const { data: customersData, isLoading: customersLoading, error: customersError, refetch: refetchCustomers } = useGetCustomersQuery(
    { search: '', limit: 100 },
    { refetchOnMountOrArgChange: true }
  );
  const customers = React.useMemo(() => {
    return customersData?.data?.customers || customersData?.customers || (Array.isArray(customersData) ? customersData : []);
  }, [customersData]);

  // Fetch suppliers for dropdown
  const { data: suppliersData, isLoading: suppliersLoading, error: suppliersError, refetch: refetchSuppliers } = useGetSuppliersQuery(
    { search: '', limit: 100 },
    { refetchOnMountOrArgChange: true }
  );
  const suppliers = React.useMemo(() => {
    return suppliersData?.data?.suppliers || suppliersData?.suppliers || (Array.isArray(suppliersData) ? suppliersData : []);
  }, [suppliersData]);

  // Sync selectedCustomer with updated customersData when it changes (optimized - only update when balance changes)
  useEffect(() => {
    if (selectedCustomer?._id && customers && customers.length > 0) {
      const updatedCustomer = customers.find(c => c._id === selectedCustomer._id);
      if (updatedCustomer) {
        // Check if any balance-related fields have changed
        const currentPending = selectedCustomer.pendingBalance || 0;
        const currentAdvance = selectedCustomer.advanceBalance || 0;
        const newPending = updatedCustomer.pendingBalance || 0;
        const newAdvance = updatedCustomer.advanceBalance || 0;

        // Only update if balances have actually changed to avoid unnecessary re-renders
        if (currentPending !== newPending || currentAdvance !== newAdvance) {
          setSelectedCustomer(updatedCustomer);
        }
      }
    }
  }, [customersData, selectedCustomer?._id]);

  // Mutations
  const [createCashReceipt, { isLoading: creating }] = useCreateCashReceiptMutation();
  const [updateCashReceipt, { isLoading: updating }] = useUpdateCashReceiptMutation();
  const [deleteCashReceipt, { isLoading: deleting }] = useDeleteCashReceiptMutation();
  const [exportExcelMutation] = useExportExcelMutation();
  const [exportCSVMutation] = useExportCSVMutation();
  const [exportPDFMutation] = useExportPDFMutation();
  const [exportJSONMutation] = useExportJSONMutation();
  const [downloadFileMutation] = useDownloadFileMutation();

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
    const customer = customers?.find(c => c._id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
    }
    setFormData(prev => ({ ...prev, customer: customerId }));

    // Clear any pending fetch
    if (customerFetchTimerRef.current) {
      clearTimeout(customerFetchTimerRef.current);
    }

    // Fetch fresh customer data with debounce to avoid rapid API calls
    customerFetchTimerRef.current = setTimeout(async () => {
      try {
        const { data: response } = await getCustomer(customerId);
        const freshCustomer = response?.data?.customer || response?.customer || response?.data || response;
        if (freshCustomer) {
          // Only update if this customer is still selected
          setSelectedCustomer(prev => {
            if (prev?._id === customerId) {
              return freshCustomer;
            }
            return prev;
          });

          // Update the customersData cache for this specific customer
          if (api.util?.setQueryData) {
            try {
              dispatch(api.util.setQueryData(['getCustomers', { search: '', limit: 100 }], (oldData) => {
                if (!oldData) return oldData;
                const customers = oldData?.data?.customers || oldData?.customers || oldData?.data || [];
                const updatedCustomers = customers.map(c =>
                  c._id === customerId ? freshCustomer : c
                );
                return {
                  ...oldData,
                  data: {
                    ...oldData.data,
                    customers: updatedCustomers
                  },
                  customers: updatedCustomers
                };
              }));
            } catch (error) {
              console.warn('Failed to update customer cache:', error);
            }
          }
        }
      } catch (error) {
        // Silently fail - keep cached data if fetch fails
      }
    }, 200); // 200ms debounce - shorter delay for better UX
  };

  const handleCustomerSearch = (searchTerm) => {
    setCustomerSearchTerm(searchTerm);
    setCustomerDropdownIndex(-1); // Reset index when searching
    if (searchTerm === '') {
      setSelectedCustomer(null);
      setFormData(prev => ({ ...prev, customer: '' }));
    }
  };

  const handleCustomerKeyDown = (e) => {
    const filteredCustomers = (customers || []).filter(customer =>
      (customer.businessName || customer.name || '').toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      (customer.phone || '').includes(customerSearchTerm)
    );

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
          handleCustomerSelect(customer._id);
          setCustomerSearchTerm(customer.businessName || customer.name || '');
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
    const supplier = suppliers?.find(s => s._id === supplierId);
    setSelectedSupplier(supplier);
    setFormData(prev => ({ ...prev, supplier: supplierId, customer: '' }));
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
  };

  const handleSupplierSearch = (searchTerm) => {
    setSupplierSearchTerm(searchTerm);
    setSupplierDropdownIndex(-1); // Reset index when searching
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
          handleSupplierSelect(supplier._id);
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
            return { ...prev, advanceBalance: newAdvanceBalance };
          });

          // Update customer in cache immediately
          if (api.util?.setQueryData) {
            try {
              dispatch(api.util.setQueryData(['getCustomers', { search: '', limit: 100 }], (oldData) => {
                if (!oldData) return oldData;
                const customers = oldData?.data?.customers || oldData?.customers || oldData?.data || [];
                const updatedCustomers = customers.map(c => {
                  if (c._id === formData.customer) {
                    const newAdvanceBalance = (c.advanceBalance || 0) + receiptAmount;
                    return { ...c, advanceBalance: newAdvanceBalance };
                  }
                  return c;
                });
                return {
                  ...oldData,
                  data: {
                    ...oldData.data,
                    customers: updatedCustomers
                  },
                  customers: updatedCustomers
                };
              }));

              // Also update individual customer query cache
              dispatch(api.util.setQueryData(['getCustomer', formData.customer], (oldData) => {
                if (!oldData) return oldData;
                const customer = oldData?.data?.customer || oldData?.customer || oldData?.data || oldData;
                const newAdvanceBalance = (customer.advanceBalance || 0) + receiptAmount;
                return {
                  ...oldData,
                  data: {
                    ...oldData.data,
                    customer: { ...customer, advanceBalance: newAdvanceBalance }
                  },
                  customer: { ...customer, advanceBalance: newAdvanceBalance }
                };
              }));
            } catch (error) {
              console.warn('Failed to update customer cache:', error);
            }
          }

          // Refetch to get accurate data from server
          refetchCustomers();
        } else if (paymentType === 'supplier' && formData.supplier && selectedSupplier) {
          const receiptAmount = parseFloat(cleanedData.amount) || 0;
          // Update selected supplier balance optimistically
          setSelectedSupplier(prev => {
            if (!prev) return prev;
            const newAdvanceBalance = (prev.advanceBalance || 0) + receiptAmount;
            return { ...prev, advanceBalance: newAdvanceBalance };
          });

          // Update supplier in cache immediately
          if (api.util?.setQueryData) {
            try {
              dispatch(api.util.setQueryData(['getSuppliers', { search: '', limit: 100 }], (oldData) => {
                if (!oldData) return oldData;
                const suppliers = oldData?.data?.suppliers || oldData?.suppliers || oldData?.data || [];
                const updatedSuppliers = suppliers.map(s => {
                  if (s._id === formData.supplier) {
                    const newAdvanceBalance = (s.advanceBalance || 0) + receiptAmount;
                    return { ...s, advanceBalance: newAdvanceBalance };
                  }
                  return s;
                });
                return {
                  ...oldData,
                  data: {
                    ...oldData.data,
                    suppliers: updatedSuppliers
                  },
                  suppliers: updatedSuppliers
                };
              }));
            } catch (error) {
              console.warn('Failed to update supplier cache:', error);
            }
          }

          // Refetch to get accurate data from server
          refetchSuppliers();
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

    updateCashReceipt({ id: selectedReceipt._id, ...cleanedData })
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
            return { ...prev, advanceBalance: newAdvanceBalance };
          });

          // Update customer in cache immediately
          if (api.util?.setQueryData) {
            try {
              dispatch(api.util.setQueryData(['getCustomers', { search: '', limit: 100 }], (oldData) => {
                if (!oldData) return oldData;
                const customers = oldData?.data?.customers || oldData?.customers || oldData?.data || [];
                const updatedCustomers = customers.map(c => {
                  if (c._id === formData.customer) {
                    const newAdvanceBalance = (c.advanceBalance || 0) + amountDifference;
                    return { ...c, advanceBalance: newAdvanceBalance };
                  }
                  return c;
                });
                return {
                  ...oldData,
                  data: {
                    ...oldData.data,
                    customers: updatedCustomers
                  },
                  customers: updatedCustomers
                };
              }));

              // Also update individual customer query cache
              dispatch(api.util.setQueryData(['getCustomer', formData.customer], (oldData) => {
                if (!oldData) return oldData;
                const customer = oldData?.data?.customer || oldData?.customer || oldData?.data || oldData;
                const newAdvanceBalance = (customer.advanceBalance || 0) + amountDifference;
                return {
                  ...oldData,
                  data: {
                    ...oldData.data,
                    customer: { ...customer, advanceBalance: newAdvanceBalance }
                  },
                  customer: { ...customer, advanceBalance: newAdvanceBalance }
                };
              }));
            } catch (error) {
              console.warn('Failed to update customer cache:', error);
            }
          }

          // Refetch to get accurate data from server
          refetchCustomers();
        } else if (paymentType === 'supplier' && formData.supplier && selectedSupplier && amountDifference !== 0) {
          // Update selected supplier balance optimistically (add the difference)
          setSelectedSupplier(prev => {
            if (!prev) return prev;
            const newAdvanceBalance = (prev.advanceBalance || 0) + amountDifference;
            return { ...prev, advanceBalance: newAdvanceBalance };
          });

          // Update supplier in cache immediately
          if (api.util?.setQueryData) {
            try {
              dispatch(api.util.setQueryData(['getSuppliers', { search: '', limit: 100 }], (oldData) => {
                if (!oldData) return oldData;
                const suppliers = oldData?.data?.suppliers || oldData?.suppliers || oldData?.data || [];
                const updatedSuppliers = suppliers.map(s => {
                  if (s._id === formData.supplier) {
                    const newAdvanceBalance = (s.advanceBalance || 0) + amountDifference;
                    return { ...s, advanceBalance: newAdvanceBalance };
                  }
                  return s;
                });
                return {
                  ...oldData,
                  data: {
                    ...oldData.data,
                    suppliers: updatedSuppliers
                  },
                  suppliers: updatedSuppliers
                };
              }));
            } catch (error) {
              console.warn('Failed to update supplier cache:', error);
            }
          }

          // Refetch to get accurate data from server
          refetchSuppliers();
        }
      })
      .catch((error) => {
        showErrorToast(handleApiError(error));
      });
  };

  const handleDelete = (receiptOrId) => {
    // Handle both receipt object and id string
    const receiptId = typeof receiptOrId === 'string' ? receiptOrId : receiptOrId._id;
    const receipt = typeof receiptOrId === 'object' ? receiptOrId : null;
    const receiptAmount = receipt ? (parseFloat(receipt.amount) || 0) : 0;
    const receiptCustomer = receipt?.customer?._id || receipt?.customer || null;
    const receiptSupplier = receipt?.supplier?._id || receipt?.supplier || null;

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
              if (prev && prev._id === receiptCustomer) {
                const newAdvanceBalance = Math.max(0, (prev.advanceBalance || 0) - receiptAmount);
                return { ...prev, advanceBalance: newAdvanceBalance };
              }
              return prev;
            });

            // Update customer in cache immediately
            if (api.util?.setQueryData) {
              try {
                dispatch(api.util.setQueryData(['getCustomers', { search: '', limit: 100 }], (oldData) => {
                  if (!oldData) return oldData;
                  const customers = oldData?.data?.customers || oldData?.customers || oldData?.data || [];
                  const updatedCustomers = customers.map(c => {
                    if (c._id === receiptCustomer) {
                      const newAdvanceBalance = Math.max(0, (c.advanceBalance || 0) - receiptAmount);
                      return { ...c, advanceBalance: newAdvanceBalance };
                    }
                    return c;
                  });
                  return {
                    ...oldData,
                    data: {
                      ...oldData.data,
                      customers: updatedCustomers
                    },
                    customers: updatedCustomers
                  };
                }));

                // Also update individual customer query cache
                dispatch(api.util.setQueryData(['getCustomer', receiptCustomer], (oldData) => {
                  if (!oldData) return oldData;
                  const customer = oldData?.data?.customer || oldData?.customer || oldData?.data || oldData;
                  const newAdvanceBalance = Math.max(0, (customer.advanceBalance || 0) - receiptAmount);
                  return {
                    ...oldData,
                    data: {
                      ...oldData.data,
                      customer: { ...customer, advanceBalance: newAdvanceBalance }
                    },
                    customer: { ...customer, advanceBalance: newAdvanceBalance }
                  };
                }));
              } catch (error) {
                console.warn('Failed to update customer cache:', error);
              }
            }

            // Refetch to get accurate data from server
            refetchCustomers();
          } else if (receiptSupplier && receiptAmount > 0) {
            // Subtract the amount from supplier balance
            setSelectedSupplier(prev => {
              if (prev && prev._id === receiptSupplier) {
                const newAdvanceBalance = Math.max(0, (prev.advanceBalance || 0) - receiptAmount);
                return { ...prev, advanceBalance: newAdvanceBalance };
              }
              return prev;
            });

            // Update supplier in cache immediately
            if (api.util?.setQueryData) {
              try {
                dispatch(api.util.setQueryData(['getSuppliers', { search: '', limit: 100 }], (oldData) => {
                  if (!oldData) return oldData;
                  const suppliers = oldData?.data?.suppliers || oldData?.suppliers || oldData?.data || [];
                  const updatedSuppliers = suppliers.map(s => {
                    if (s._id === receiptSupplier) {
                      const newAdvanceBalance = Math.max(0, (s.advanceBalance || 0) - receiptAmount);
                      return { ...s, advanceBalance: newAdvanceBalance };
                    }
                    return s;
                  });
                  return {
                    ...oldData,
                    data: {
                      ...oldData.data,
                      suppliers: updatedSuppliers
                    },
                    suppliers: updatedSuppliers
                  };
                }));
              } catch (error) {
                console.warn('Failed to update supplier cache:', error);
              }
            }

            // Refetch to get accurate data from server
            refetchSuppliers();
          }
        })
        .catch((error) => {
          showErrorToast(handleApiError(error));
        });
    }
  };

  const handleEdit = (receipt) => {
    setSelectedReceipt(receipt);
    setFormData({
      date: receipt.date ? receipt.date.split('T')[0] : '',
      amount: receipt.amount || '',
      particular: receipt.particular || '',
      customer: receipt.customer?._id || '',
      supplier: receipt.supplier?._id || '',
      notes: receipt.notes || ''
    });
    // Set payment type based on which entity is present
    if (receipt.supplier?._id) {
      setPaymentType('supplier');
      setSelectedSupplier(receipt.supplier);
      setSupplierSearchTerm(receipt.supplier.companyName || receipt.supplier.name || '');
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
    } else if (receipt.customer?._id) {
      setPaymentType('customer');
      setSelectedCustomer(receipt.customer);
      setCustomerSearchTerm(receipt.customer.businessName || receipt.customer.name || '');
      setSelectedSupplier(null);
      setSupplierSearchTerm('');
    }
    setShowEditModal(true);
  };

  const handleView = (receipt) => {
    setSelectedReceipt(receipt);
    setShowViewModal(true);
  };

  const handleExport = async (format = 'csv') => {
    try {
      const payload = { ...filters, ...pagination, sortConfig };
      let response;
      if (format === 'excel') {
        response = await exportExcelMutation(payload).unwrap();
      } else if (format === 'pdf') {
        response = await exportPDFMutation(payload).unwrap();
      } else if (format === 'json') {
        response = await exportJSONMutation(payload).unwrap();
      } else {
        response = await exportCSVMutation(payload).unwrap();
      }

      const filename =
        response?.filename ||
        (format === 'excel'
          ? 'cash_receipts.xlsx'
          : format === 'pdf'
            ? 'cash_receipts.pdf'
            : format === 'json'
              ? 'cash_receipts.json'
              : 'cash_receipts.csv');

      const downloadResponse = await downloadFileMutation(filename).unwrap();
      const blob =
        downloadResponse instanceof Blob
          ? downloadResponse
          : new Blob([downloadResponse], {
            type:
              format === 'excel'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : format === 'pdf'
                  ? 'application/pdf'
                  : format === 'json'
                    ? 'application/json'
                    : 'text/csv',
          });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSuccessToast(`Exported cash receipts as ${format.toUpperCase()}`);
    } catch (error) {
      showErrorToast(handleApiError(error, 'Cash Receipts Export'));
    }
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cash Receipts</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage and view all cash receipt transactions</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="btn btn-outline btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
          <button
            onClick={resetForm}
            className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span>New Receipt</span>
          </button>
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
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <label className="flex items-center">
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
                      className="mr-2"
                    />
                    <span className="text-xs sm:text-sm text-gray-700">Customer</span>
                  </label>
                  <label className="flex items-center">
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
                      className="mr-2"
                    />
                    <span className="text-xs sm:text-sm text-gray-700">Supplier</span>
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
                    <input
                      type="text"
                      value={customerSearchTerm}
                      onChange={(e) => handleCustomerSearch(e.target.value)}
                      onKeyDown={handleCustomerKeyDown}
                      className="input w-full pr-10"
                      placeholder="Search or select customer..."
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  {customerSearchTerm && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                      {(customers || []).filter(customer =>
                        (customer.businessName || customer.name || '').toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                        (customer.phone || '').includes(customerSearchTerm)
                      ).map((customer, index) => {
                        const receivables = customer.pendingBalance || 0;
                        const advance = customer.advanceBalance || 0;
                        const netBalance = receivables - advance;
                        const isPayable = netBalance < 0;
                        const isReceivable = netBalance > 0;
                        const hasBalance = receivables > 0 || advance > 0;

                        return (
                          <div
                            key={customer._id}
                            onClick={() => {
                              handleCustomerSelect(customer._id);
                              setCustomerSearchTerm(customer.businessName || customer.name || '');
                              setCustomerDropdownIndex(-1);
                            }}
                            className={`px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${customerDropdownIndex === index ? 'bg-blue-50' : ''
                              }`}
                          >
                            <div className="font-medium text-gray-900">{customer.businessName || customer.name || 'Unknown'}</div>
                            {hasBalance && (
                              <div className={`text-sm ${isPayable ? 'text-red-600' : 'text-green-600'}`}>
                                {isPayable ? 'Payables:' : 'Receivables:'} ${Math.abs(netBalance).toFixed(2)}
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
                    <input
                      type="text"
                      value={supplierSearchTerm}
                      onChange={(e) => handleSupplierSearch(e.target.value)}
                      onKeyDown={handleSupplierKeyDown}
                      className="input w-full pr-10"
                      placeholder="Search or select supplier..."
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  {supplierSearchTerm && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                      {(suppliers || []).filter(supplier =>
                        (supplier.companyName || supplier.name || '').toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
                        (supplier.phone || '').includes(supplierSearchTerm)
                      ).map((supplier, index) => (
                        <div
                          key={supplier._id}
                          onClick={() => {
                            handleSupplierSelect(supplier._id);
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
                      ))}
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
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => {
                    const value = e.target.value === '' ? '' : parseFloat(e.target.value) || '';
                    setFormData(prev => ({ ...prev, amount: value }));
                  }}
                  className="input w-full"
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
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="input w-full pr-10"
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={formData.particular}
                  onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
                  className="input w-full"
                  placeholder="Enter receipt description..."
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="input w-full h-20 resize-none"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={resetForm}
              className="btn btn-outline btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Save className="h-4 w-4" />
              <span>{creating ? 'Saving...' : 'Save Receipt'}</span>
            </button>
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
            {/* Date Range */}
            <div className="col-span-2">
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
              <input
                type="text"
                placeholder="Contains..."
                value={filters.voucherCode}
                onChange={(e) => handleFilterChange('voucherCode', e.target.value)}
                className="input"
              />
            </div>

            {/* Amount Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <input
                type="number"
                placeholder="Equals..."
                value={filters.amount}
                onChange={(e) => handleFilterChange('amount', e.target.value)}
                className="input"
              />
            </div>

            {/* Particular Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Particular
              </label>
              <input
                type="text"
                placeholder="Contains..."
                value={filters.particular}
                onChange={(e) => handleFilterChange('particular', e.target.value)}
                className="input"
              />
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <button
                onClick={() => refetch()}
                className="btn btn-primary btn-md w-full flex items-center justify-center gap-2"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Cash Receipts From: {formatDate(filters.fromDate)} To: {formatDate(filters.toDate)}
            </h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                {paginationInfo.totalItems || 0} records
              </span>
              <button
                onClick={() => refetch()}
                className="p-2 text-gray-400 hover:text-gray-600"
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
                        Customer
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
                    {cashReceipts.map((receipt, index) => (
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {receipt.customer ? ((receipt.customer.businessName || receipt.customer.name)?.toUpperCase() || 'N/A') : 'N/A'}
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
                            {formatDateForInput(receipt.date) === today && (
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
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {paginationInfo.totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === paginationInfo.totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing{' '}
                        <span className="font-medium">
                          {(pagination.page - 1) * pagination.limit + 1}
                        </span>{' '}
                        to{' '}
                        <span className="font-medium">
                          {Math.min(pagination.page * pagination.limit, paginationInfo.totalItems)}
                        </span>{' '}
                        of{' '}
                        <span className="font-medium">{paginationInfo.totalItems}</span>{' '}
                        results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                          disabled={pagination.page === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        {Array.from({ length: Math.min(5, paginationInfo.totalPages) }, (_, i) => {
                          const pageNum = i + 1;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${pagination.page === pageNum
                                ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                          disabled={pagination.page === paginationInfo.totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Modal - Removed */}
      {false && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-4/5 max-w-4xl shadow-lg rounded-lg bg-white">
            <div className="mb-6 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">Receipt Details</h3>
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
                    <input
                      type="text"
                      value={customerSearchTerm}
                      onChange={(e) => handleCustomerSearch(e.target.value)}
                      className="input w-full pr-10"
                      placeholder="Search or select customer..."
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  {customerSearchTerm && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                      {(customers || []).filter(customer =>
                        (customer.businessName || customer.name || '').toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                        customer.phone?.includes(customerSearchTerm)
                      ).map((customer) => (
                        <div
                          key={customer._id}
                          onClick={() => {
                            handleCustomerSelect(customer._id);
                            setCustomerSearchTerm(customer.businessName || customer.name || '');
                          }}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{customer.businessName || customer.name || 'Unknown'}</div>
                          {customer.phone && (
                            <div className="text-sm text-gray-500">{customer.phone}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Receivables
                  </label>
                  <input
                    type="text"
                    value={selectedCustomer?.pendingBalance ? `${selectedCustomer.pendingBalance}` : 'No pending balance'}
                    className="input w-full bg-gray-50"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.particular}
                    onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
                    className="input w-full resize-none"
                    rows="4"
                    placeholder="Enter receipt description or notes..."
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
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="input w-full pr-10"
                    />
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => {
                      const value = e.target.value === '' ? '' : parseFloat(e.target.value) || '';
                      setFormData(prev => ({ ...prev, amount: value }));
                    }}
                    className="input w-full"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="input w-full resize-none"
                    rows="3"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={resetForm}
                className="btn btn-outline btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </button>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  className="btn btn-outline btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Preview</span>
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Save className="h-4 w-4" />
                  <span>{creating ? 'Saving...' : 'Save Receipt'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Cash Receipt</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedReceipt(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => {
                      const value = e.target.value === '' ? '' : parseFloat(e.target.value) || '';
                      setFormData(prev => ({ ...prev, amount: value }));
                    }}
                    className="input w-full"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Particular
                  </label>
                  <textarea
                    value={formData.particular}
                    onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
                    className="input w-full"
                    rows="3"
                    placeholder="Enter transaction details..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer (Optional)
                  </label>
                  <select
                    value={formData.customer}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
                    className="input w-full"
                    disabled={customersLoading}
                  >
                    <option value="">
                      {customersLoading ? 'Loading customers...' : 'Select Customer'}
                    </option>
                    {customers?.map((customer) => (
                      <option key={customer._id} value={customer._id}>
                        {customer.businessName || customer.name} {customer.phone ? `(${customer.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="input w-full"
                    rows="2"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedReceipt(null);
                    resetForm();
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={updating}
                  className="btn btn-primary"
                >
                  {updating ? 'Updating...' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedReceipt && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Cash Receipt Details</h3>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedReceipt(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Voucher Code
                  </label>
                  <p className="text-sm text-gray-900">{selectedReceipt.voucherCode}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <p className="text-sm text-gray-900">{formatDate(selectedReceipt.date)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <p className="text-sm text-gray-900">{Math.round(selectedReceipt.amount)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Particular
                  </label>
                  <p className="text-sm text-gray-900">{selectedReceipt.particular}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <p className="text-sm text-gray-900 capitalize">{selectedReceipt.paymentMethod.replace('_', ' ')}</p>
                </div>
                {selectedReceipt.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <p className="text-sm text-gray-900">{selectedReceipt.notes}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Created By
                  </label>
                  <p className="text-sm text-gray-900">
                    {selectedReceipt.createdBy?.firstName} {selectedReceipt.createdBy?.lastName}
                  </p>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedReceipt(null);
                  }}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
