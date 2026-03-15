import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  Download,
  RefreshCw,
  ArrowUpDown,
  Calendar,
  Save,
  RotateCcw,
  Printer,
  Phone,
  Mail,
  MapPin,
  Building,
  User
} from 'lucide-react';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { formatDate } from '../utils/formatters';
import ReceiptPaymentPrintModal from '../components/ReceiptPaymentPrintModal';
import {
  useGetCashPaymentsQuery,
  useCreateCashPaymentMutation,
  useUpdateCashPaymentMutation,
  useDeleteCashPaymentMutation,
  useExportExcelMutation,
  useExportCSVMutation,
  useExportPDFMutation,
  useExportJSONMutation,
  useDownloadFileMutation,
} from '../store/services/cashPaymentsApi';
import { useGetSuppliersQuery } from '../store/services/suppliersApi';
import { useGetCustomersQuery } from '../store/services/customersApi';
import { useGetAccountsQuery } from '../store/services/chartOfAccountsApi';
import { useAppDispatch } from '../store/hooks';
import { api } from '../store/api';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, formatDateForInput } from '../utils/dateUtils';

const CashPayments = () => {
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
  const [supplierDropdownIndex, setSupplierDropdownIndex] = useState(-1);
  const [customerDropdownIndex, setCustomerDropdownIndex] = useState(-1);
  const [expenseDropdownIndex, setExpenseDropdownIndex] = useState(-1);

  // Fetch cash payments
  const {
    data: cashPaymentsData,
    isLoading,
    error,
    refetch,
  } = useGetCashPaymentsQuery({ ...filters, ...pagination, sortConfig }, { refetchOnMountOrArgChange: true });

  // Fetch suppliers for dropdown
  const { data: suppliersData, isLoading: suppliersLoading, error: suppliersError, refetch: refetchSuppliers } = useGetSuppliersQuery(
    { search: '', limit: 100 },
    { refetchOnMountOrArgChange: true }
  );

  // Fetch customers for dropdown
  const { data: customersData, isLoading: customersLoading, error: customersError, refetch: refetchCustomers } = useGetCustomersQuery(
    { search: '', limit: 100 },
    { refetchOnMountOrArgChange: true }
  );

  // Fetch expense accounts from Chart of Accounts
  const { data: expenseAccountsData, isLoading: expenseAccountsLoading } = useGetAccountsQuery(
    { accountType: 'expense', isActive: 'true' },
    { refetchOnMountOrArgChange: true }
  );

  const suppliers = React.useMemo(() => {
    return suppliersData?.data?.suppliers || suppliersData?.suppliers || (Array.isArray(suppliersData) ? suppliersData : []);
  }, [suppliersData]);
  const customers = customersData?.data?.customers || customersData?.customers || (Array.isArray(customersData) ? customersData : []);
  const expenseAccounts =
    expenseAccountsData?.data ||
    expenseAccountsData?.accounts ||
    expenseAccountsData ||
    [];

  // Update selected supplier when suppliers data changes
  useEffect(() => {
    if (selectedSupplier && suppliers.length > 0) {
      const updatedSupplier = suppliers.find(s => s._id === selectedSupplier._id);
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
    if (selectedCustomer && customers.length > 0) {
      const updatedCustomer = customers.find(c => c._id === selectedCustomer._id);
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
  const [createCashPayment, { isLoading: creating }] = useCreateCashPaymentMutation();
  const [updateCashPayment, { isLoading: updating }] = useUpdateCashPaymentMutation();
  const [deleteCashPayment, { isLoading: deleting }] = useDeleteCashPaymentMutation();
  const [exportExcelMutation] = useExportExcelMutation();
  const [exportCSVMutation] = useExportCSVMutation();
  const [exportPDFMutation] = useExportPDFMutation();
  const [exportJSONMutation] = useExportJSONMutation();
  const [downloadFileMutation] = useDownloadFileMutation();

  const dispatch = useAppDispatch();

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
    setSupplierDropdownIndex(-1);
    setCustomerDropdownIndex(-1);
    setExpenseDropdownIndex(-1);
  };

  const handleSupplierSelect = (supplierId) => {
    const supplier = suppliers.find(s => s._id === supplierId);
    setSelectedSupplier(supplier);
    setFormData(prev => ({ ...prev, supplier: supplierId, customer: '' }));
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
  };

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find(c => c._id === customerId);
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customer: customerId, supplier: '' }));
    setSelectedSupplier(null);
    setSupplierSearchTerm('');
  };

  const handleSupplierSearch = (searchTerm) => {
    setSupplierSearchTerm(searchTerm);
    setSupplierDropdownIndex(-1); // Reset index when searching
    if (searchTerm === '') {
      setSelectedSupplier(null);
      setFormData(prev => ({ ...prev, supplier: '' }));
    }
  };

  const handleCustomerSearch = (searchTerm) => {
    setCustomerSearchTerm(searchTerm);
    setCustomerDropdownIndex(-1); // Reset index when searching
    if (searchTerm === '') {
      setSelectedCustomer(null);
      setFormData(prev => ({ ...prev, customer: '' }));
    }
  };

  const handleExpenseAccountSelect = (accountId) => {
    const account = expenseAccounts?.find(a => a._id === accountId);
    setSelectedExpenseAccount(account);
    setFormData(prev => ({ ...prev, particular: account?.accountName || '' }));
  };

  const handleExpenseSearch = (searchTerm) => {
    setExpenseSearchTerm(searchTerm);
    setExpenseDropdownIndex(-1); // Reset index when searching
    if (searchTerm === '') {
      setSelectedExpenseAccount(null);
      setFormData(prev => ({ ...prev, particular: '' }));
    }
  };

  const handleExpenseKeyDown = (e) => {
    const filteredAccounts = expenseAccounts?.filter(account =>
      (account.accountName || '').toLowerCase().includes(expenseSearchTerm.toLowerCase()) ||
      (account.accountCode || '').includes(expenseSearchTerm)
    ) || [];

    if (!expenseSearchTerm || filteredAccounts.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setExpenseDropdownIndex(prev =>
          prev < filteredAccounts.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setExpenseDropdownIndex(prev =>
          prev > 0 ? prev - 1 : filteredAccounts.length - 1
        );
        break;

      case 'Enter':
        e.preventDefault();
        if (expenseDropdownIndex >= 0 && expenseDropdownIndex < filteredAccounts.length) {
          const account = filteredAccounts[expenseDropdownIndex];
          handleExpenseAccountSelect(account._id);
          setExpenseSearchTerm(account.accountName || '');
          setExpenseDropdownIndex(-1);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setExpenseSearchTerm('');
        setExpenseDropdownIndex(-1);
        break;
    }
  };

  const handleSupplierKeyDown = (e) => {
    const filteredSuppliers = suppliers.filter(supplier =>
      (supplier.companyName || supplier.name || supplier.displayName || '').toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
      (supplier.phone || '').includes(supplierSearchTerm) ||
      (supplier.email || '').toLowerCase().includes(supplierSearchTerm.toLowerCase())
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
          setSupplierSearchTerm(supplier.displayName || supplier.companyName || supplier.name || '');
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
    const filteredCustomers = (customers || []).filter(customer => {
      const displayName = customer.displayName || customer.businessName || customer.name ||
        `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email || '';
      return (
        displayName.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
        (customer.phone || '').includes(customerSearchTerm) ||
        (customer.email || '').toLowerCase().includes(customerSearchTerm.toLowerCase())
      );
    }) || [];

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
          const displayName = customer.displayName || customer.businessName || customer.name ||
            `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email || '';
          handleCustomerSelect(customer._id);
          setCustomerSearchTerm(displayName);
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
          refetchCustomers();
        } else if (paymentType === 'supplier' && formData.supplier) {
          refetchSuppliers();
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

    updateCashPayment({ id: selectedPayment._id, ...submissionData })
      .unwrap()
      .then(() => {
        setShowEditModal(false);
        setSelectedPayment(null);
        resetForm();
        showSuccessToast('Cash payment updated successfully');
        refetch();
        // Refetch customer/supplier data to update balances immediately
        if (paymentType === 'customer' && formData.customer) {
          refetchCustomers();
        } else if (paymentType === 'supplier' && formData.supplier) {
          refetchSuppliers();
        }
      })
      .catch((error) => {
        showErrorToast(handleApiError(error));
      });
  };

  const handleDelete = (payment) => {
    if (window.confirm('Are you sure you want to delete this cash payment?')) {
      deleteCashPayment(payment._id)
        .unwrap()
        .then(() => {
          showSuccessToast('Cash payment deleted successfully');
          refetch();
          // Refetch customer/supplier data to update balances immediately
          if (payment.customer) {
            refetchCustomers();
          } else if (payment.supplier) {
            refetchSuppliers();
          }
        })
        .catch((error) => {
          showErrorToast(handleApiError(error));
        });
    }
  };

  const handleEdit = (payment) => {
    setSelectedPayment(payment);
    setFormData({
      date: payment.date ? payment.date.split('T')[0] : today,
      amount: payment.amount || '',
      particular: payment.particular || '',
      supplier: payment.supplier?._id || '',
      customer: payment.customer?._id || '',
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
      setCustomerSearchTerm(payment.customer.displayName || payment.customer.businessName || payment.customer.name || '');
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
          ? 'cash_payments.xlsx'
          : format === 'pdf'
            ? 'cash_payments.pdf'
            : format === 'json'
              ? 'cash_payments.json'
              : 'cash_payments.csv');

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
      showSuccessToast(`Exported cash payments as ${format.toUpperCase()}`);
    } catch (error) {
      showErrorToast(handleApiError(error, 'Cash Payments Export'));
    }
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
  const paginationInfo =
    cashPaymentsData?.data?.pagination ||
    cashPaymentsData?.pagination ||
    {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cash Payments</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage and view all cash payment transactions</p>
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
            <span>New Payment</span>
          </button>
        </div>
      </div>

      {/* Cash Payment Form */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-base sm:text-lg font-medium text-gray-900">Payment Details</h3>
        </div>
        <div className="card-content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Payment Type Selection */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Payment Type
                </label>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
                </div>
              </div>

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
                      {suppliers.filter(supplier =>
                        (supplier.companyName || supplier.name || supplier.displayName || '').toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
                        (supplier.phone || '').includes(supplierSearchTerm) ||
                        (supplier.email || '').toLowerCase().includes(supplierSearchTerm.toLowerCase())
                      ).map((supplier, index) => (
                        <div
                          key={supplier._id}
                          onClick={() => {
                            handleSupplierSelect(supplier._id);
                            setSupplierSearchTerm(supplier.displayName || supplier.companyName || supplier.name || '');
                            setSupplierDropdownIndex(-1);
                          }}
                          className={`px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${supplierDropdownIndex === index ? 'bg-blue-50' : ''
                            }`}
                        >
                          <div className="font-medium text-gray-900">
                            {supplier.displayName || supplier.companyName || supplier.name || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-600 capitalize mt-0.5">
                            {supplier.businessType && supplier.reliability
                              ? `${supplier.businessType} • ${supplier.reliability}`
                              : supplier.businessType || supplier.reliability || ''
                            }
                          </div>
                          <div className="flex items-center space-x-3 mt-1">
                            <div className="text-sm text-gray-600">
                              <span className="text-gray-500">Outstanding Balance:</span>{' '}
                              <span className={`font-medium ${(supplier.pendingBalance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                ${Math.round(supplier.pendingBalance || 0)}
                              </span>
                            </div>
                            {supplier.phone && (
                              <div className="flex items-center space-x-1 text-sm text-gray-500">
                                <Phone className="h-3 w-3" />
                                <span>{supplier.phone}</span>
                              </div>
                            )}
                            {supplier.email && (
                              <div className="flex items-center space-x-1 text-sm text-gray-500">
                                <Mail className="h-3 w-3" />
                                <span>{supplier.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Supplier Information Card */}
                  {selectedSupplier && (
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center space-x-3">
                        <Building className="h-5 w-5 text-gray-400" />
                        <div className="flex-1">
                          <p className="font-medium">
                            {selectedSupplier.displayName || selectedSupplier.companyName || selectedSupplier.name || 'Unknown Supplier'}
                          </p>
                          <p className="text-sm text-gray-600 capitalize">
                            {selectedSupplier.businessType && selectedSupplier.reliability
                              ? `${selectedSupplier.businessType} • ${selectedSupplier.reliability}`
                              : selectedSupplier.businessType || selectedSupplier.reliability || 'Supplier Information'
                            }
                          </p>
                          <div className="flex items-center space-x-4 mt-2">
                            <div className="flex items-center space-x-1">
                              <span className="text-xs text-gray-500">Outstanding Balance:</span>
                              <span className={`text-sm font-medium ${(selectedSupplier.pendingBalance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                ${Math.round(selectedSupplier.pendingBalance || 0)}
                              </span>
                            </div>
                            {selectedSupplier.phone && (
                              <div className="flex items-center space-x-1">
                                <Phone className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-500">{selectedSupplier.phone}</span>
                              </div>
                            )}
                            {selectedSupplier.email && (
                              <div className="flex items-center space-x-1">
                                <Mail className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-500">{selectedSupplier.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                      placeholder="Search customers by name, email, or business..."
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  {customerSearchTerm && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                      {(customers || []).filter(customer => {
                        const displayName = customer.displayName || customer.businessName || customer.name ||
                          `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email || '';
                        return (
                          displayName.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                          (customer.phone || '').includes(customerSearchTerm) ||
                          (customer.email || '').toLowerCase().includes(customerSearchTerm.toLowerCase())
                        );
                      }).map((customer, index) => {
                        const receivables = customer.pendingBalance || 0;
                        const advance = customer.advanceBalance || 0;
                        const netBalance = receivables - advance;
                        const isPayable = netBalance < 0;
                        const isReceivable = netBalance > 0;
                        const hasBalance = receivables > 0 || advance > 0;
                        const displayName = customer.displayName || customer.businessName || customer.name ||
                          `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email || 'Unknown';

                        return (
                          <div
                            key={customer._id}
                            onClick={() => {
                              handleCustomerSelect(customer._id);
                              setCustomerSearchTerm(displayName);
                              setCustomerDropdownIndex(-1);
                            }}
                            className={`px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${customerDropdownIndex === index ? 'bg-blue-50' : ''
                              }`}
                          >
                            <div className="font-medium text-gray-900">{displayName}</div>
                            <div className="text-sm text-gray-600 capitalize mt-0.5">
                              {customer.businessType || ''}
                            </div>
                            <div className="flex items-center space-x-3 mt-1">
                              {hasBalance && (
                                <div className="text-sm text-gray-600">
                                  <span className="text-gray-500">{isPayable ? 'Payables:' : 'Receivables:'}</span>{' '}
                                  <span className={`font-medium ${isPayable ? 'text-red-600' : 'text-green-600'}`}>
                                    ${Math.abs(netBalance).toFixed(2)}
                                  </span>
                                </div>
                              )}
                              {customer.phone && (
                                <div className="flex items-center space-x-1 text-sm text-gray-500">
                                  <Phone className="h-3 w-3" />
                                  <span>{customer.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Customer Information Card */}
                  {selectedCustomer && (
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center space-x-3">
                        <User className="h-5 w-5 text-gray-400" />
                        <div className="flex-1">
                          <p className="font-medium">
                            {selectedCustomer.displayName || selectedCustomer.businessName || selectedCustomer.name ||
                              `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim() ||
                              selectedCustomer.email || 'Unknown Customer'}
                          </p>
                          <p className="text-sm text-gray-600 capitalize">
                            {selectedCustomer.businessType ? `${selectedCustomer.businessType} • ` : ''}
                            {selectedCustomer.phone || 'No phone'}
                          </p>
                          <div className="flex items-center space-x-4 mt-2">
                            {(() => {
                              const receivables = selectedCustomer.pendingBalance || 0;
                              const advance = selectedCustomer.advanceBalance || 0;
                              const netBalance = receivables - advance;
                              const isPayable = netBalance < 0;
                              const isReceivable = netBalance > 0;
                              const hasBalance = receivables > 0 || advance > 0;

                              return hasBalance ? (
                                <div className="flex items-center space-x-1">
                                  <span className="text-xs text-gray-500">{isPayable ? 'Payables:' : 'Receivables:'}</span>
                                  <span className={`text-sm font-medium ${isPayable ? 'text-red-600' : isReceivable ? 'text-green-600' : 'text-gray-600'
                                    }`}>
                                    ${Math.abs(netBalance).toFixed(2)}
                                  </span>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Expense Description */}
              {paymentType === 'expense' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expense Description *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={expenseSearchTerm}
                      onChange={(e) => handleExpenseSearch(e.target.value)}
                      onKeyDown={handleExpenseKeyDown}
                      className="input w-full pr-10"
                      placeholder="Search expense account (e.g., Rent Expense, Utilities Expense, etc.)"
                      required
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  {expenseSearchTerm && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                      {expenseAccounts?.filter(account =>
                        (account.accountName || '').toLowerCase().includes(expenseSearchTerm.toLowerCase()) ||
                        (account.accountCode || '').includes(expenseSearchTerm)
                      ).map((account, index) => (
                        <div
                          key={account._id}
                          onClick={() => {
                            handleExpenseAccountSelect(account._id);
                            setExpenseSearchTerm(account.accountName || '');
                            setExpenseDropdownIndex(-1);
                          }}
                          className={`px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${expenseDropdownIndex === index ? 'bg-blue-50' : ''
                            }`}
                        >
                          <div className="font-medium text-gray-900">{account.accountName || 'Unknown'}</div>
                          {account.accountCode && (
                            <div className="text-sm text-gray-500">Code: {account.accountCode}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Balance Display */}
              {(selectedSupplier || selectedCustomer) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Balance
                  </label>
                  <div className="space-y-1">
                    {paymentType === 'supplier' && selectedSupplier && (
                      <>
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
                      </>
                    )}
                    {paymentType === 'customer' && selectedCustomer && (
                      <>
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
                      </>
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
              {/* Payment Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Date
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
                  Description
                </label>
                <input
                  type="text"
                  value={formData.particular}
                  onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
                  className="input w-full"
                  placeholder="Enter payment description or notes..."
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
              <span>{creating ? 'Saving...' : 'Save Payment'}</span>
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
              Cash Payments From: {formatDate(filters.fromDate)} To: {formatDate(filters.toDate)}
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
              <p className="mt-2 text-gray-500">Loading cash payments...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              <p>Error loading cash payments: {handleApiError(error).message}</p>
            </div>
          ) : cashPayments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No cash payments found for the selected criteria.</p>
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
                    {cashPayments.map((payment, index) => (
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
                          {payment.supplier ? (
                            <div>
                              <div className="font-medium">
                                {payment.supplier.companyName || payment.supplier.displayName || payment.supplier.name || 'Unknown Supplier'}
                              </div>
                              <div className="text-gray-500 text-xs">Supplier</div>
                            </div>
                          ) : payment.customer ? (
                            <div>
                              <div className="font-medium">
                                {((payment.customer.businessName || payment.customer.displayName || payment.customer.name ||
                                  `${payment.customer.firstName || ''} ${payment.customer.lastName || ''}`.trim() ||
                                  payment.customer.email || 'Unknown Customer') || '').toUpperCase()}
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
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handlePrint(payment)}
                              className="text-green-600 hover:text-green-900"
                              title="Print"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleView(payment)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {formatDateForInput(payment.date) === today && (
                              <>
                                <button
                                  onClick={() => handleEdit(payment)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(payment)}
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
            </>
          )}
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
      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Cash Payment</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedPayment(null);
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
                    {paymentType === 'supplier' ? 'Supplier' : 'Customer'} (Optional)
                  </label>
                  <select
                    value={paymentType === 'supplier' ? formData.supplier : formData.customer}
                    onChange={(e) => setFormData(prev => ({ ...prev, [paymentType === 'supplier' ? 'supplier' : 'customer']: e.target.value }))}
                    className="input w-full"
                    disabled={paymentType === 'supplier' ? suppliersLoading : customersLoading}
                  >
                    <option value="">
                      {paymentType === 'supplier'
                        ? (suppliersLoading ? 'Loading suppliers...' : 'Select Supplier')
                        : (customersLoading ? 'Loading customers...' : 'Select Customer')
                      }
                    </option>
                    {paymentType === 'supplier'
                      ? suppliers?.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.displayName || s.companyName || s.name}
                        </option>
                      ))
                      : customers?.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.displayName || c.businessName || c.name}
                        </option>
                      ))
                    }
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
                    setSelectedPayment(null);
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
      {showViewModal && selectedPayment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Cash Payment Details</h3>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedPayment(null);
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
                  <p className="text-sm text-gray-900">{selectedPayment.voucherCode}</p>
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
                    <p className="text-sm text-gray-900">{selectedPayment.supplier.companyName || selectedPayment.supplier.displayName || selectedPayment.supplier.name}</p>
                  </div>
                )}
                {selectedPayment.customer && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer
                    </label>
                    <p className="text-sm text-gray-900">{(selectedPayment.customer.businessName || selectedPayment.customer.displayName || selectedPayment.customer.name || '').toUpperCase()}</p>
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
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedPayment(null);
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
    </div>
  );
};

export default CashPayments;
