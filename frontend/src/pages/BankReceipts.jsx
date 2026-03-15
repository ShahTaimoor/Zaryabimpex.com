import React, { useState } from 'react';
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
  Printer
} from 'lucide-react';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { formatDate } from '../utils/formatters';
import { useGetCustomersQuery } from '../store/services/customersApi';
import { useGetSuppliersQuery } from '../store/services/suppliersApi';
import { useGetBanksQuery } from '../store/services/banksApi';
import {
  useGetBankReceiptsQuery,
  useCreateBankReceiptMutation,
  useUpdateBankReceiptMutation,
  useDeleteBankReceiptMutation,
  useExportExcelMutation,
  useExportCSVMutation,
  useExportPDFMutation,
  useExportJSONMutation,
  useDownloadFileMutation,
} from '../store/services/bankReceiptsApi';
import ReceiptPaymentPrintModal from '../components/ReceiptPaymentPrintModal';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, formatDateForInput } from '../utils/dateUtils';

const BankReceipts = () => {
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

  // Fetch customers for dropdown
  const { data: customersData, isLoading: customersLoading, error: customersError, refetch: refetchCustomers } = useGetCustomersQuery(
    { search: '', limit: 100 },
    { skip: false }
  );
  const customers = React.useMemo(() => {
    return customersData?.data?.customers || customersData?.customers || [];
  }, [customersData]);

  // Fetch suppliers for dropdown
  const { data: suppliersData, isLoading: suppliersLoading, error: suppliersError, refetch: refetchSuppliers } = useGetSuppliersQuery(
    { search: '', limit: 100 },
    { skip: false }
  );
  const suppliers = React.useMemo(() => {
    return suppliersData?.data?.suppliers || suppliersData?.suppliers || [];
  }, [suppliersData]);

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
    const customer = customers?.find(c => c._id === customerId);
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customer: customerId }));
  };

  const handleCustomerSearch = (searchTerm) => {
    setCustomerSearchTerm(searchTerm);
    if (searchTerm === '') {
      setSelectedCustomer(null);
      setFormData(prev => ({ ...prev, customer: '' }));
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
    if (searchTerm === '') {
      setSelectedSupplier(null);
      setFormData(prev => ({ ...prev, supplier: '' }));
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
      bank: formData.bank,
      transactionReference: formData.transactionReference,
      customer: paymentType === 'customer' ? formData.customer : undefined,
      supplier: paymentType === 'supplier' ? formData.supplier : undefined,
      notes: formData.notes
    };

    updateBankReceipt({ id: selectedReceipt._id, ...submissionData })
      .unwrap()
      .then(() => {
        setShowEditModal(false);
        setSelectedReceipt(null);
        resetForm();
        showSuccessToast('Bank receipt updated successfully');
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

  const handleDelete = (receipt) => {
    if (window.confirm('Are you sure you want to delete this bank receipt?')) {
      deleteBankReceipt(receipt._id)
        .unwrap()
        .then(() => {
          showSuccessToast('Bank receipt deleted successfully');
          refetch();
          // Refetch customer/supplier data to update balances immediately
          if (receipt.customer) {
            refetchCustomers();
          } else if (receipt.supplier) {
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
      date: receipt.date ? receipt.date.split('T')[0] : today,
      amount: receipt.amount || '',
      particular: receipt.particular || '',
      bank: receipt.bank?._id || '',
      transactionReference: receipt.transactionReference || '',
      customer: receipt.customer?._id || '',
      supplier: receipt.supplier?._id || '',
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
          ? 'bank_receipts.xlsx'
          : format === 'pdf'
            ? 'bank_receipts.pdf'
            : format === 'json'
              ? 'bank_receipts.json'
              : 'bank_receipts.csv');

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
      showSuccessToast(`Exported bank receipts as ${format.toUpperCase()}`);
    } catch (error) {
      showErrorToast(handleApiError(error, 'Bank Receipts Export'));
    }
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
  const paginationInfo =
    bankReceiptsData?.data?.pagination ||
    bankReceiptsData?.pagination ||
    {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Bank Receipts</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage and view all bank receipt transactions</p>
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
                      className="input w-full pr-10"
                      placeholder="Search or select customer..."
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  {customerSearchTerm && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                      {customers?.filter(customer =>
                        (customer.businessName || customer.name || '').toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                        (customer.phone || '').includes(customerSearchTerm)
                      ).map((customer) => {
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
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
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
                      className="input w-full pr-10"
                      placeholder="Search or select supplier..."
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  {supplierSearchTerm && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                      {suppliers?.filter(supplier =>
                        (supplier.companyName || supplier.name || '').toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
                        (supplier.phone || '').includes(supplierSearchTerm)
                      ).map((supplier) => (
                        <div
                          key={supplier._id}
                          onClick={() => {
                            handleSupplierSelect(supplier._id);
                            setSupplierSearchTerm(supplier.companyName || supplier.name || '');
                          }}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
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
                  {banks?.map((bank) => (
                    <option key={bank._id} value={bank._id}>
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
              </div>

              {/* Transaction Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction Reference
                </label>
                <input
                  type="text"
                  value={formData.transactionReference}
                  onChange={(e) => setFormData(prev => ({ ...prev, transactionReference: e.target.value }))}
                  className="input w-full"
                  placeholder="Enter transaction reference..."
                />
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
                  placeholder="Enter receipt description or notes..."
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
              Bank Receipts From: {formatDate(filters.fromDate)} To: {formatDate(filters.toDate)}
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
              <p className="mt-2 text-gray-500">Loading bank receipts...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              <p>Error loading bank receipts: {handleApiError(error).message}</p>
            </div>
          ) : bankReceipts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No bank receipts found for the selected criteria.</p>
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
                          {receipt.bank ? (
                            <div>
                              <div className="font-medium">{receipt.bank.bankName}</div>
                              <div className="text-gray-500 text-xs">{receipt.bank.accountNumber}</div>
                            </div>
                          ) : (
                            receipt.bankAccount || 'N/A'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {receipt.customer ? (
                            <div>
                              <div className="font-medium">{(receipt.customer.businessName || receipt.customer.name || '').toUpperCase()}</div>
                              <div className="text-gray-500 text-xs">{receipt.customer.email}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
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
            </>
          )}
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
                      {customers?.filter(customer =>
                        (customer.businessName || customer.name || '').toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                        (customer.phone || '').includes(customerSearchTerm)
                      ).map((customer) => {
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
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
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
                    Bank Account <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.bank}
                    onChange={(e) => setFormData(prev => ({ ...prev, bank: e.target.value }))}
                    className="input w-full"
                    required
                  >
                    <option value="">Select bank account...</option>
                    {banks?.map((bank) => (
                      <option key={bank._id} value={bank._id}>
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
                  <textarea
                    value={formData.particular}
                    onChange={(e) => setFormData(prev => ({ ...prev, particular: e.target.value }))}
                    className="input w-full resize-none"
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
                    Transaction Reference
                  </label>
                  <input
                    type="text"
                    value={formData.transactionReference}
                    onChange={(e) => setFormData(prev => ({ ...prev, transactionReference: e.target.value }))}
                    className="input w-full"
                    placeholder="Enter transaction reference (optional)"
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
                <h3 className="text-lg font-medium text-gray-900">Edit Bank Receipt</h3>
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
                    Bank Account
                  </label>
                  <select
                    value={formData.bank}
                    onChange={(e) => setFormData(prev => ({ ...prev, bank: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="">Select bank account...</option>
                    {banks?.map((bank) => (
                      <option key={bank._id} value={bank._id}>
                        {bank.bankName} - {bank.accountNumber}
                      </option>
                    ))}
                  </select>
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
                    Transaction Reference
                  </label>
                  <input
                    type="text"
                    value={formData.transactionReference}
                    onChange={(e) => setFormData(prev => ({ ...prev, transactionReference: e.target.value }))}
                    className="input w-full"
                    placeholder="Enter reference..."
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
                <h3 className="text-lg font-medium text-gray-900">Bank Receipt Details</h3>
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
                  <span className="text-gray-900 font-bold">${Math.round(selectedReceipt.amount)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-gray-500">Bank:</span>
                  <span className="text-gray-900">{selectedReceipt.bank?.bankName || 'N/A'}</span>
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
                    <span className="text-gray-900">{selectedReceipt.customer.displayName || selectedReceipt.customer.businessName || selectedReceipt.customer.name}</span>
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
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedReceipt(null);
                  }}
                  className="btn btn-secondary w-full"
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

export default BankReceipts;
