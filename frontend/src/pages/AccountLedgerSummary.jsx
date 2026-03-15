import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Users, Building2, Search, Calendar, Download, FileText, ChevronDown, Printer } from 'lucide-react';
import { useGetLedgerSummaryQuery, useGetCustomerDetailedTransactionsQuery, useGetSupplierDetailedTransactionsQuery } from '../store/services/accountLedgerApi';
import { useGetCustomersQuery } from '../store/services/customersApi';
import { useGetSuppliersQuery } from '../store/services/suppliersApi';
import { useLazyGetOrderByIdQuery } from '../store/services/salesApi';
import { useLazyGetCashReceiptByIdQuery } from '../store/services/cashReceiptsApi';
import { useLazyGetBankReceiptByIdQuery } from '../store/services/bankReceiptsApi';
import { useLazyGetPurchaseInvoiceQuery } from '../store/services/purchaseInvoicesApi';

import PrintModal from '../components/PrintModal';
import ReceiptPaymentPrintModal from '../components/ReceiptPaymentPrintModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { handleApiError } from '../utils/errorHandler';
import toast from 'react-hot-toast';

const AccountLedgerSummary = () => {

  // Function to get default date range (today for both)
  const getDefaultDateRange = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    return {
      startDate: todayStr,
      endDate: todayStr
    };
  };

  const defaultDates = getDefaultDateRange();

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const customerDropdownRef = useRef(null);

  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const supplierDropdownRef = useRef(null);
  const printRef = useRef(null);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [printDocumentTitle, setPrintDocumentTitle] = useState('Invoice');
  const [printPartyLabel, setPrintPartyLabel] = useState('Customer');
  const [showReceiptPrintModal, setShowReceiptPrintModal] = useState(false);
  const [receiptPrintData, setReceiptPrintData] = useState(null);
  const [receiptPrintTitle, setReceiptPrintTitle] = useState('Receipt');
  const [printLoading, setPrintLoading] = useState(false);

  const [getOrderById] = useLazyGetOrderByIdQuery();
  const [getCashReceiptById] = useLazyGetCashReceiptByIdQuery();
  const [getBankReceiptById] = useLazyGetBankReceiptByIdQuery();
  const [getPurchaseInvoiceById] = useLazyGetPurchaseInvoiceQuery();


  const [filters, setFilters] = useState({
    startDate: defaultDates.startDate,
    endDate: defaultDates.endDate,
    search: ''
  });

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target)) {
        setShowSupplierDropdown(false);
      }
    };

    if (showCustomerDropdown || showSupplierDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomerDropdown, showSupplierDropdown]);

  // Fetch customers for dropdown
  const { data: customersData, isLoading: customersLoading } = useGetCustomersQuery(
    { search: customerSearchQuery, limit: 100 },
    { refetchOnMountOrArgChange: true }
  );

  const allCustomers = useMemo(() => {
    return customersData?.data?.customers || customersData?.customers || customersData?.data || customersData || [];
  }, [customersData]);

  // Fetch suppliers for dropdown
  const { data: suppliersData, isLoading: suppliersLoading } = useGetSuppliersQuery(
    { search: supplierSearchQuery, limit: 100 },
    { refetchOnMountOrArgChange: true }
  );

  const allSuppliers = useMemo(() => {
    return suppliersData?.data?.suppliers || suppliersData?.suppliers || suppliersData?.data || suppliersData || [];
  }, [suppliersData]);

  // Build query params with customerId and supplierId
  const queryParams = useMemo(() => {
    const params = { ...filters };
    if (selectedCustomerId) {
      params.customerId = selectedCustomerId;
    }
    if (selectedSupplierId) {
      params.supplierId = selectedSupplierId;
    }
    return params;
  }, [filters, selectedCustomerId, selectedSupplierId]);

  // Fetch ledger summary - refetch on mount and when args change to ensure fresh data
  const { data: summaryData, isLoading, error, refetch } = useGetLedgerSummaryQuery(queryParams, {
    refetchOnMountOrArgChange: true, // Always refetch on mount or when query params change
    refetchOnFocus: true, // Refetch when window regains focus
    refetchOnReconnect: true, // Refetch when connection is restored
    onError: (error) => handleApiError(error, 'Error fetching ledger summary')
  });

  // Fetch detailed transactions for selected customer
  const { data: detailedTransactionsData, isLoading: detailedLoading } = useGetCustomerDetailedTransactionsQuery(
    {
      customerId: selectedCustomerId,
      startDate: filters.startDate,
      endDate: filters.endDate
    },
    {
      skip: !selectedCustomerId,
      onError: (error) => handleApiError(error, 'Error fetching detailed transactions')
    }
  );

  // Fetch detailed transactions for selected supplier
  const { data: detailedSupplierTransactionsData, isLoading: detailedSupplierLoading } = useGetSupplierDetailedTransactionsQuery(
    {
      supplierId: selectedSupplierId,
      startDate: filters.startDate,
      endDate: filters.endDate
    },
    {
      skip: !selectedSupplierId,
      onError: (error) => handleApiError(error, 'Error fetching detailed supplier transactions')
    }
  );

  // Extract data from summary (must be before early return)
  const allCustomersSummary = summaryData?.data?.customers?.summary || [];
  const suppliers = summaryData?.data?.suppliers?.summary || [];
  const customerTotals = summaryData?.data?.customers?.totals || {};
  const supplierTotals = summaryData?.data?.suppliers?.totals || {};
  const period = summaryData?.data?.period || {};

  // Filter customers based on selection (must be before early return)
  const customers = useMemo(() => {
    if (!selectedCustomerId) return [];
    return allCustomersSummary.filter(c => {
      const customerId = c.id?.toString() || c._id?.toString();
      const selectedId = selectedCustomerId.toString();
      return customerId === selectedId;
    });
  }, [allCustomersSummary, selectedCustomerId]);

  // Filter customers for dropdown (must be before early return)
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return allCustomers.slice(0, 50);
    const query = customerSearchQuery.toLowerCase();
    return allCustomers.filter(customer => {
      const name = (customer.businessName || customer.name || '').toLowerCase();
      const email = (customer.email || '').toLowerCase();
      const phone = (customer.phone || '').toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    }).slice(0, 50);
  }, [allCustomers, customerSearchQuery]);

  // Filter suppliers based on selection (must be before early return)
  const filteredSuppliersList = useMemo(() => {
    if (!selectedSupplierId) return [];
    return suppliers.filter(s => {
      const supplierId = s.id?.toString() || s._id?.toString();
      const selectedId = selectedSupplierId.toString();
      return supplierId === selectedId;
    });
  }, [suppliers, selectedSupplierId]);

  // Filter suppliers for dropdown (must be before early return)
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchQuery.trim()) return allSuppliers.slice(0, 50);
    const query = supplierSearchQuery.toLowerCase();
    return allSuppliers.filter(supplier => {
      const name = (supplier.companyName || supplier.name || '').toLowerCase();
      const email = (supplier.email || '').toLowerCase();
      const phone = (supplier.phone || '').toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    }).slice(0, 50);
  }, [allSuppliers, supplierSearchQuery]);

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: defaultDates.startDate,
      endDate: defaultDates.endDate,
      search: ''
    });
    setSelectedCustomerId('');
    setCustomerSearchQuery('');
    setSelectedSupplierId('');
    setSupplierSearchQuery('');
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomerId(customer._id);
    setCustomerSearchQuery(customer.businessName || customer.name || '');
    setShowCustomerDropdown(false);
    // Clear supplier selection when customer is selected
    setSelectedSupplierId('');
    setSupplierSearchQuery('');
  };

  const handleSupplierSelect = (supplier) => {
    setSelectedSupplierId(supplier._id);
    setSupplierSearchQuery(supplier.companyName || supplier.name || '');
    setShowSupplierDropdown(false);
    // Clear customer selection when supplier is selected
    setSelectedCustomerId('');
    setCustomerSearchQuery('');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const year = d.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  };

  const handlePrintEntry = async (entry) => {
    if (!entry?.referenceId || !entry?.source) {
      toast.error('Print not available for this row.');
      return;
    }
    setPrintLoading(true);
    setPrintData(null);
    try {
      if (entry.source === 'Sale') {
        const result = await getOrderById(entry.referenceId).unwrap();
        const order = result?.order || result?.data?.order || result;
        if (order) {
          setPrintDocumentTitle('Sales Invoice');
          setPrintPartyLabel('Customer');
          setPrintData(order);
          setShowPrintModal(true);
        } else {
          toast.error('Could not load sale for printing.');
        }
      } else if (entry.source === 'Cash Receipt') {
        const result = await getCashReceiptById(entry.referenceId).unwrap();
        const receipt = result?.data || result;
        if (receipt) {
          setReceiptPrintTitle('Cash Receipt');
          setReceiptPrintData(receipt);
          setShowReceiptPrintModal(true);
        } else {
          toast.error('Could not load receipt for printing.');
        }
      } else if (entry.source === 'Bank Receipt') {
        const result = await getBankReceiptById(entry.referenceId).unwrap();
        const receipt = result?.data || result;
        if (receipt) {
          setReceiptPrintTitle('Bank Receipt');
          setReceiptPrintData(receipt);
          setShowReceiptPrintModal(true);
        } else {
          toast.error('Could not load bank receipt for printing.');
        }
      } else if (entry.source === 'Purchase') {
        const result = await getPurchaseInvoiceById(entry.referenceId).unwrap();
        const invoice = result?.invoice || result?.data?.invoice || result?.data || result;
        if (invoice) {
          setPrintDocumentTitle('Purchase Invoice');
          setPrintPartyLabel('Supplier');
          setPrintData(invoice);
          setShowPrintModal(true);
        } else {
          toast.error('Could not load purchase invoice for printing.');
        }
      } else if (entry.source === 'Cash Payment' || entry.source === 'Bank Payment') {
        toast('Print this payment from Cash Payments or Bank Payments page.');
      } else {
        toast('Print this document from the relevant module (e.g. Bank Receipts, Cash Payments, Sale Returns).');
      }
    } catch (err) {
      handleApiError(err, 'Load document for print');
      toast.error('Could not load document for printing.');
    } finally {
      setPrintLoading(false);
    }
  };

  const handleExport = () => {
    toast.info('Export functionality coming soon');
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) {
      toast.error('No content to print. Please select a customer or supplier.');
      return;
    }

    const printWindow = window.open('', '_blank');
    const customerName = selectedCustomerId
      ? (detailedTransactionsData?.data?.customer?.name || 'Customer Receivables')
      : (detailedSupplierTransactionsData?.data?.supplier?.name || 'Supplier Payables');
    const accountCode = selectedCustomerId
      ? (detailedTransactionsData?.data?.customer?.accountCode || '')
      : (detailedSupplierTransactionsData?.data?.supplier?.accountCode || '');

    printWindow.document.write(`
      <html>
        <head>
          <title>Account Ledger Summary - ${customerName}</title>
          <style>
            @page {
              size: portrait;
              margin: 10mm;
            }
            @media print {
              body { 
                margin: 0; 
                padding: 0;
                font-family: 'Inter', Arial, sans-serif;
                font-size: 10px;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print { display: none !important; }
              table { width: 100% !important; border: 1px solid #000 !important; }
              th, td { border: 1px solid #000 !important; }
            }
            body {
              font-family: 'Inter', Arial, sans-serif;
              font-size: 10px;
              color: #000;
              margin: 0;
              padding: 0;
            }
            .print-header {
              text-align: center;
              margin-bottom: 10px;
              border-bottom: 1px solid #000;
             
            }
            .print-header h1 {
              font-size: 16px;
              font-weight: 700;
              margin: 0;
              text-transform: uppercase;
            }
            .print-header p {
              font-size: 10px;
              margin: 2px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th {
              background-color: #eee !important;
              text-align: center;
              padding: 3px;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            td {
              padding: 2px 4px;
              font-size: 9.5px;
              vertical-align: middle;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: 700; }
            .bg-gray-50 { background-color: #fafafa !important; -webkit-print-color-adjust: exact !important; }
            .bg-gray-100 { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact !important; }
            .print-footer {
              margin-top: 10px;
              text-align: right;
              font-size: 8px;
              border-top: 1px solid #000;
              padding-top: 4px;
            }
          </style>
        </head>
        <body>

          ${printContent.innerHTML}
          <div class="print-footer">
            <p>Generated on ${new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Early return for error (after all hooks)
  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading ledger summary</p>
          <button onClick={() => refetch()} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Account Ledger Summary</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Customer Receivables and Supplier Payables</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="btn btn-secondary btn-md flex items-center gap-2"
            disabled={!selectedCustomerId && !selectedSupplierId}
            title={!selectedCustomerId && !selectedSupplierId ? 'Please select a customer or supplier to print' : 'Print ledger summary'}
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            onClick={handleExport}
            className="btn btn-secondary btn-md flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 sm:gap-4">
          {/* Customer Dropdown */}
          <div className="relative" ref={customerDropdownRef}>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Select Customer
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Select customer..."
                value={customerSearchQuery}
                onChange={(e) => {
                  setCustomerSearchQuery(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                className="input w-full"
              />
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredCustomers.map((customer) => {
                    const displayName = customer.businessName || customer.name || 'Unknown Customer';
                    return (
                      <button
                        key={customer._id}
                        onClick={() => handleCustomerSelect(customer)}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${selectedCustomerId === customer._id ? 'bg-blue-50' : ''
                          }`}
                      >
                        <div className="text-sm font-medium text-gray-900">{displayName}</div>
                        {customer.email && (
                          <div className="text-xs text-gray-500">{customer.email}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Supplier Dropdown */}
          <div className="relative" ref={supplierDropdownRef}>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Select Supplier
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Select supplier..."
                value={supplierSearchQuery}
                onChange={(e) => {
                  setSupplierSearchQuery(e.target.value);
                  setShowSupplierDropdown(true);
                }}
                onFocus={() => setShowSupplierDropdown(true)}
                className="input w-full"
              />
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              {showSupplierDropdown && filteredSuppliers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredSuppliers.map((supplier) => {
                    const displayName = supplier.companyName || supplier.name || 'Unknown Supplier';
                    return (
                      <button
                        key={supplier._id}
                        onClick={() => handleSupplierSelect(supplier)}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${selectedSupplierId === supplier._id ? 'bg-blue-50' : ''
                          }`}
                      >
                        <div className="text-sm font-medium text-gray-900">{displayName}</div>
                        {supplier.email && (
                          <div className="text-xs text-gray-500">{supplier.email}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, phone..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="input w-full pl-10"
              />
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              From Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="input w-full pl-10"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              To Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="input w-full pl-10"
              />
            </div>
          </div>

          {/* Clear Button */}
          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="btn btn-outline btn-md w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Period Display */}
        {period.startDate && period.endDate && (
          <div className="mt-4 text-sm text-gray-600">
            <span className="font-medium">Period:</span> {formatDate(period.startDate)} to {formatDate(period.endDate)}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Customers Section - Show only if customer is selected and supplier is not */}
          {selectedCustomerId && !selectedSupplierId && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="h-6 w-6 text-blue-600" />
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {detailedTransactionsData?.data?.customer?.name || 'Customer Receivables'}
                      </h2>
                      <p className="text-sm text-gray-600">
                        Account Code: {detailedTransactionsData?.data?.customer?.accountCode || ''}
                      </p>
                      {filters.startDate && filters.endDate && (
                        <p className="text-xs text-gray-500 mt-1">
                          Period: {formatDate(filters.startDate)} to {formatDate(filters.endDate)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {detailedLoading ? (
                <div className="flex justify-center items-center py-12">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Voucher No
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Particular
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Debits
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Credits
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Balance
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-20 no-print">
                          Print
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Opening Balance Row */}
                      <tr className="bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900"></td>
                        <td className="px-4 py-3 text-sm text-gray-900"></td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Opening Balance:</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900"></td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900"></td>
                        <td className={`px-4 py-3 text-sm text-right font-bold ${(detailedTransactionsData?.data?.openingBalance || 0) < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                          {formatCurrency(detailedTransactionsData?.data?.openingBalance || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center no-print"></td>
                      </tr>

                      {/* Transaction Rows */}
                      {detailedTransactionsData?.data?.entries?.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p>No transactions found for this period</p>
                          </td>
                        </tr>
                      ) : (
                        detailedTransactionsData?.data?.entries?.map((entry, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatDate(entry.date)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {entry.voucherNo || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {entry.particular || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {entry.debitAmount > 0 ? formatCurrency(entry.debitAmount) : '0'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {entry.creditAmount > 0 ? formatCurrency(entry.creditAmount) : '0'}
                            </td>
                            <td className={`px-4 py-3 text-sm text-right font-semibold ${(entry.balance || 0) < 0 ? 'text-red-600' : 'text-gray-900'
                              }`}>
                              {formatCurrency(entry.balance || 0)}
                            </td>
                            <td className="px-4 py-3 text-center no-print">
                              {entry.referenceId && entry.source && entry.source === 'Sale' ? (
                                <button
                                  type="button"
                                  onClick={() => handlePrintEntry(entry)}
                                  disabled={printLoading}
                                  className="inline-flex items-center justify-center p-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                                  title="Print this bill"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Total Row */}
                      {detailedTransactionsData?.data?.entries?.length > 0 && (
                        <tr className="bg-gray-100 font-bold">
                          <td className="px-4 py-3 text-sm text-gray-900"></td>
                          <td className="px-4 py-3 text-sm text-gray-900"></td>
                          <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatCurrency(
                              detailedTransactionsData?.data?.entries?.reduce((sum, e) => sum + (e.debitAmount || 0), 0) || 0
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatCurrency(
                              detailedTransactionsData?.data?.entries?.reduce((sum, e) => sum + (e.creditAmount || 0), 0) || 0
                            )}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right text-gray-900 ${(detailedTransactionsData?.data?.closingBalance || 0) < 0 ? 'text-red-600' : ''
                            }`}>
                            {formatCurrency(detailedTransactionsData?.data?.closingBalance || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-center no-print"></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Suppliers Section - Show only if supplier is selected and customer is not */}
          {selectedSupplierId && !selectedCustomerId && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-orange-600" />
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {detailedSupplierTransactionsData?.data?.supplier?.name || 'Supplier Payables'}
                      </h2>
                      <p className="text-sm text-gray-600">
                        Account Code: {detailedSupplierTransactionsData?.data?.supplier?.accountCode || ''}
                      </p>
                      {filters.startDate && filters.endDate && (
                        <p className="text-xs text-gray-500 mt-1">
                          Period: {formatDate(filters.startDate)} to {formatDate(filters.endDate)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Table */}
              {detailedSupplierLoading ? (
                <div className="flex justify-center items-center py-12">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Voucher No</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Particular</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Debits</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Credits</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Balance</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-20 no-print">Print</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Opening Balance Row */}
                      <tr className="bg-gray-50">
                        <td colSpan="3" className="px-4 py-3 text-sm font-medium text-gray-900">Opening Balance:</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">0</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">0</td>
                        <td className={`px-4 py-3 text-sm text-right font-bold ${(detailedSupplierTransactionsData?.data?.openingBalance || 0) < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                          {formatCurrency(detailedSupplierTransactionsData?.data?.openingBalance || 0)}
                        </td>
                        <td className="px-4 py-3 text-center no-print"></td>
                      </tr>

                      {/* Transaction Entries */}
                      {detailedSupplierTransactionsData?.data?.entries?.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p>No transactions found for this period</p>
                          </td>
                        </tr>
                      ) : (
                        detailedSupplierTransactionsData?.data?.entries?.map((entry, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatDate(entry.date)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {entry.voucherNo || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 max-w-md whitespace-normal break-words">
                              {entry.particular || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {entry.debitAmount > 0 ? formatCurrency(entry.debitAmount) : '0'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {entry.creditAmount > 0 ? formatCurrency(entry.creditAmount) : '0'}
                            </td>
                            <td className={`px-4 py-3 text-sm text-right font-semibold ${(entry.balance || 0) < 0 ? 'text-red-600' : 'text-gray-900'
                              }`}>
                              {formatCurrency(entry.balance || 0)}
                            </td>
                            <td className="px-4 py-3 text-center no-print">
                              {entry.referenceId && entry.source && entry.source === 'Purchase' ? (
                                <button
                                  type="button"
                                  onClick={() => handlePrintEntry(entry)}
                                  disabled={printLoading}
                                  className="inline-flex items-center justify-center p-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                                  title="Print this bill"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Total Row */}
                      {detailedSupplierTransactionsData?.data?.entries?.length > 0 && (
                        <tr className="bg-gray-100 font-bold">
                          <td className="px-4 py-3 text-sm text-gray-900"></td>
                          <td className="px-4 py-3 text-sm text-gray-900"></td>
                          <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatCurrency(
                              detailedSupplierTransactionsData?.data?.entries?.reduce((sum, e) => sum + (e.debitAmount || 0), 0) || 0
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatCurrency(
                              detailedSupplierTransactionsData?.data?.entries?.reduce((sum, e) => sum + (e.creditAmount || 0), 0) || 0
                            )}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right text-gray-900 ${(detailedSupplierTransactionsData?.data?.closingBalance || 0) < 0 ? 'text-red-600' : ''
                            }`}>
                            {formatCurrency(detailedSupplierTransactionsData?.data?.closingBalance || 0)}
                          </td>
                          <td className="px-4 py-3 text-center no-print"></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Empty State - Show only if neither customer nor supplier is selected */}
          {!selectedCustomerId && !selectedSupplierId && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
              <div className="flex justify-center gap-4 mb-4">
                <Users className="h-12 w-12 text-gray-400" />
                <Building2 className="h-12 w-12 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg">Please select a customer or supplier from the dropdown above to view their ledger summary</p>
            </div>
          )}
        </div>
      )}

      {/* Print Modal for invoices (Sale, Purchase) */}
      <PrintModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setPrintData(null);
        }}
        orderData={printData}
        documentTitle={printDocumentTitle}
        partyLabel={printPartyLabel}
      />

      {/* Receipt / Payment print modal – for Cash Receipt, Bank Receipt only (separate from invoice PrintModal) */}
      <ReceiptPaymentPrintModal
        isOpen={showReceiptPrintModal}
        onClose={() => {
          setShowReceiptPrintModal(false);
          setReceiptPrintData(null);
        }}
        documentTitle={receiptPrintTitle}
        receiptData={receiptPrintData}
      />

      {/* Hidden Print Section */}
      <div className="hidden print:block" ref={printRef}>
        <div className="print-header text-center mb-4">
          <h1 className="text-xl font-bold uppercase underline">Account Ledger Summary</h1>
          <p className="font-bold">
            {selectedCustomerId
              ? (detailedTransactionsData?.data?.customer?.name || 'Customer Receivables')
              : (detailedSupplierTransactionsData?.data?.supplier?.name || 'Supplier Payables')}
            {(selectedCustomerId ? detailedTransactionsData?.data?.customer?.accountCode : detailedSupplierTransactionsData?.data?.supplier?.accountCode)
              ? ` - Account Code: ${(selectedCustomerId ? detailedTransactionsData?.data?.customer?.accountCode : detailedSupplierTransactionsData?.data?.supplier?.accountCode)}`
              : ''}
          </p>
          <p>Period: {formatDate(filters.startDate)} to {formatDate(filters.endDate)}</p>
        </div>

        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '10px' }}>
          <thead>
            <tr>
              <th style={{ width: '4%', border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>S.NO</th>
              <th style={{ width: '8%', border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>DATE</th>
              <th style={{ width: '60%', border: '1px solid #000', padding: '6px 2px', textAlign: 'left' }}>DESCRIPTION</th>
              <th style={{ width: '8%', border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>DEBITS</th>
              <th style={{ width: '8%', border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>CREDITS</th>
              <th style={{ width: '8%', border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>BALANCE</th>
            </tr>
          </thead>
          <tbody>
            {/* Opening Balance */}
            <tr>
              <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>-</td>
              <td style={{ border: '1px solid #000', padding: '6px 2px' }}></td>
              <td style={{ border: '1px solid #000', padding: '6px 2px', fontWeight: 'bold' }}>Opening Balance</td>
              <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>0</td>
              <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>0</td>
              <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right', fontWeight: 'bold' }}>
                {formatCurrency(
                  (selectedCustomerId ? detailedTransactionsData?.data?.openingBalance : detailedSupplierTransactionsData?.data?.openingBalance) || 0
                )}
              </td>
            </tr>

            {/* Transaction Rows */}
            {(selectedCustomerId ? detailedTransactionsData?.data?.entries : detailedSupplierTransactionsData?.data?.entries)?.map((entry, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>{index + 1}</td>
                <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>{formatDate(entry.date)}</td>
                <td style={{ border: '1px solid #000', padding: '6px 2px' }}>
                  <span className="font-medium">{entry.particular || '-'}</span>
                  {entry.voucherNo && entry.voucherNo !== '-' && (
                    <span className="ml-1">
                      {entry.particular && entry.particular.toLowerCase().includes('sale') ? '#' : ''}:{entry.voucherNo}
                    </span>
                  )}
                </td>
                <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>
                  {entry.debitAmount > 0 ? formatCurrency(entry.debitAmount) : '0'}
                </td>
                <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>
                  {entry.creditAmount > 0 ? formatCurrency(entry.creditAmount) : '0'}
                </td>
                <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>
                  {formatCurrency(entry.balance || 0)}
                </td>
              </tr>
            ))}

            {/* Total Row */}
            <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}>
              <td colSpan="3" style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>Total</td>
              <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>
                {formatCurrency(
                  (selectedCustomerId ? detailedTransactionsData?.data?.entries : detailedSupplierTransactionsData?.data?.entries)?.reduce((sum, e) => sum + (e.debitAmount || 0), 0) || 0
                )}
              </td>
              <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>
                {formatCurrency(
                  (selectedCustomerId ? detailedTransactionsData?.data?.entries : detailedSupplierTransactionsData?.data?.entries)?.reduce((sum, e) => sum + (e.creditAmount || 0), 0) || 0
                )}
              </td>
              <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>
                {formatCurrency(
                  (selectedCustomerId ? detailedTransactionsData?.data?.closingBalance : detailedSupplierTransactionsData?.data?.closingBalance) || 0
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccountLedgerSummary;
