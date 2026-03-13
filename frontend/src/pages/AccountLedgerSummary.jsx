import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Users, Building2, Calendar, Download, FileText, ChevronDown, Printer } from 'lucide-react';
import { useGetLedgerSummaryQuery, useGetCustomerDetailedTransactionsQuery, useGetSupplierDetailedTransactionsQuery } from '../store/services/accountLedgerApi';
import { useGetCustomersQuery } from '../store/services/customersApi';
import { useGetSuppliersQuery } from '../store/services/suppliersApi';
import { useLazyGetOrderByIdQuery, usePostMissingSalesToLedgerMutation, useSyncSalesLedgerMutation } from '../store/services/salesApi';
import { useSyncPurchaseInvoicesLedgerMutation } from '../store/services/purchaseInvoicesApi';
import { useLazyGetCashReceiptByIdQuery } from '../store/services/cashReceiptsApi';
import { useLazyGetBankReceiptByIdQuery } from '../store/services/bankReceiptsApi';
import { useLazyGetPurchaseInvoiceQuery } from '../store/services/purchaseInvoicesApi';
import { useLazyGetSaleReturnQuery } from '../store/services/saleReturnsApi';
import { useLazyGetPurchaseReturnQuery } from '../store/services/purchaseReturnsApi';

import PrintModal from '../components/PrintModal';
import { PrintModal as BasePrintModal, ReturnPrintContent } from '../components/print';
import ReceiptPaymentPrintModal from '../components/ReceiptPaymentPrintModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { handleApiError } from '../utils/errorHandler';
import { getId } from '../utils/entityId';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  const [postMissingSalesToLedger, { isLoading: isBackfillLoading }] = usePostMissingSalesToLedgerMutation();
  const [syncSalesLedger, { isLoading: isSyncLoading }] = useSyncSalesLedgerMutation();
  const [syncPurchaseInvoicesLedger, { isLoading: isSyncPurchaseLoading }] = useSyncPurchaseInvoicesLedgerMutation();
  const [getCashReceiptById] = useLazyGetCashReceiptByIdQuery();
  const [getBankReceiptById] = useLazyGetBankReceiptByIdQuery();
  const [getPurchaseInvoiceById] = useLazyGetPurchaseInvoiceQuery();
  const [getSaleReturnById] = useLazyGetSaleReturnQuery();
  const [getPurchaseReturnById] = useLazyGetPurchaseReturnQuery();
  const { companyInfo } = useCompanyInfo();

  const [showReturnPrintModal, setShowReturnPrintModal] = useState(false);
  const [returnPrintData, setReturnPrintData] = useState(null);

  const [filters, setFilters] = useState({
    startDate: defaultDates.startDate,
    endDate: defaultDates.endDate,
    search: ''
  });

  const [showReturnColumn, setShowReturnColumn] = useState(() => {
    const saved = localStorage.getItem('accountLedgerShowReturnColumn');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem('accountLedgerShowReturnColumn');
      setShowReturnColumn(saved === null ? true : saved === 'true');
    };
    window.addEventListener('accountLedgerConfigChanged', handler);
    return () => window.removeEventListener('accountLedgerConfigChanged', handler);
  }, []);

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

  // Refetch when sale return or other ledger-affecting action happens (e.g. from another tab)
  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener('accountLedgerInvalidate', handler);
    return () => window.removeEventListener('accountLedgerInvalidate', handler);
  }, [refetch]);

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

  // Derive single-customer view: backend may return data.openingBalance/data.customer/data.entries when customerId is set, or only data.customers.summary
  const customerDetail = useMemo(() => {
    if (!selectedCustomerId) return null;
    const d = detailedTransactionsData?.data;
    if (d?.openingBalance !== undefined || d?.customer) {
      return {
        openingBalance: d.openingBalance ?? 0,
        closingBalance: d.closingBalance ?? d.openingBalance ?? 0,
        returnTotal: d.returnTotal ?? 0,
        customer: d.customer ?? {},
        entries: Array.isArray(d.entries) ? d.entries : []
      };
    }
    const summary = summaryData?.data?.customers?.summary;
    const one = Array.isArray(summary) && summary.length === 1 ? summary[0] : summary?.find(s => (s?.id ?? s?._id) === selectedCustomerId);
    if (!one) return null;
    return {
      openingBalance: one.openingBalance ?? 0,
      closingBalance: one.closingBalance ?? one.openingBalance ?? 0,
      returnTotal: one.returnTotal ?? 0,
      customer: { id: one.id ?? one._id, name: one.name ?? '', accountCode: one.accountCode ?? '' },
      entries: []
    };
  }, [selectedCustomerId, detailedTransactionsData?.data, summaryData?.data?.customers?.summary]);

  const supplierDetail = useMemo(() => {
    if (!selectedSupplierId) return null;
    const d = detailedSupplierTransactionsData?.data;
    if (d?.openingBalance !== undefined || d?.supplier) {
      return {
        openingBalance: d.openingBalance ?? 0,
        closingBalance: d.closingBalance ?? d.openingBalance ?? 0,
        supplier: d.supplier ?? {},
        entries: Array.isArray(d.entries) ? d.entries : []
      };
    }
    const summary = summaryData?.data?.suppliers?.summary;
    const one = Array.isArray(summary) && summary.length === 1 ? summary[0] : summary?.find(s => (s?.id ?? s?._id) === selectedSupplierId);
    if (!one) return null;
    return {
      openingBalance: one.openingBalance ?? 0,
      closingBalance: one.closingBalance ?? one.openingBalance ?? 0,
      supplier: { id: one.id ?? one._id, name: one.name ?? '', accountCode: one.accountCode ?? '' },
      entries: []
    };
  }, [selectedSupplierId, detailedSupplierTransactionsData?.data, summaryData?.data?.suppliers?.summary]);

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
      const customerId = getId(c)?.toString();
      const selectedId = selectedCustomerId?.toString();
      return customerId === selectedId;
    });
  }, [allCustomersSummary, selectedCustomerId]);

  // Filter customers for dropdown (search by business name, company name, name)
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return allCustomers.slice(0, 50);
    const query = customerSearchQuery.toLowerCase();
    return allCustomers.filter(customer => {
      const businessName = (customer.businessName || customer.business_name || '').toLowerCase();
      const companyName = (customer.companyName || customer.company_name || '').toLowerCase();
      const name = (customer.name || '').toLowerCase();
      const email = (customer.email || '').toLowerCase();
      const phone = (customer.phone || '').toLowerCase();
      return businessName.includes(query) || companyName.includes(query) || name.includes(query) || email.includes(query) || phone.includes(query);
    }).slice(0, 50);
  }, [allCustomers, customerSearchQuery]);

  // Filter suppliers based on selection (must be before early return)
  const filteredSuppliersList = useMemo(() => {
    if (!selectedSupplierId) return [];
    return suppliers.filter(s => {
      const supplierId = getId(s)?.toString();
      const selectedId = selectedSupplierId?.toString();
      return supplierId === selectedId;
    });
  }, [suppliers, selectedSupplierId]);

  // Filter suppliers for dropdown (search by business name, company name, name)
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchQuery.trim()) return allSuppliers.slice(0, 50);
    const query = supplierSearchQuery.toLowerCase();
    return allSuppliers.filter(supplier => {
      const companyName = (supplier.companyName || supplier.company_name || '').toLowerCase();
      const businessName = (supplier.businessName || supplier.business_name || '').toLowerCase();
      const name = (supplier.name || '').toLowerCase();
      const email = (supplier.email || '').toLowerCase();
      const phone = (supplier.phone || '').toLowerCase();
      return companyName.includes(query) || businessName.includes(query) || name.includes(query) || email.includes(query) || phone.includes(query);
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
    setSelectedCustomerId(getId(customer));
    const businessName = customer.businessName || customer.business_name || customer.companyName || customer.company_name || '';
    setCustomerSearchQuery(businessName || customer.name || '');
    setShowCustomerDropdown(false);
    // Clear supplier selection when customer is selected
    setSelectedSupplierId('');
    setSupplierSearchQuery('');
  };

  const handleSupplierSelect = (supplier) => {
    setSelectedSupplierId(getId(supplier));
    setSupplierSearchQuery(supplier.companyName || supplier.name || '');
    setShowSupplierDropdown(false);
    // Clear customer selection when supplier is selected
    setSelectedCustomerId('');
    setCustomerSearchQuery('');
  };

  const formatCurrency = (amount) => {
    const n = Number(amount);
    if (n !== n) return '0'; // NaN
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(n);
  };

  // Safe sum for ledger totals (entries may have numeric strings from API)
  const sumDebits = (entries) => (entries ?? []).reduce((sum, e) => sum + (Number(e.debitAmount) || 0), 0);
  const sumCredits = (entries) => (entries ?? []).reduce((sum, e) => sum + (Number(e.creditAmount) || 0), 0);
  // Closing balance calculation:
  // For Supplier Payables (liability): Opening + Credits - Debits (credits increase what you owe, debits decrease)
  // For Customer Receivables (asset): Opening + Debits - Credits (debits increase what they owe, credits decrease)
  // Since we're showing supplier payables when supplier is selected, use: Opening + Credits - Debits
  const closingBalanceFromEntries = (openingBalance, entries, isSupplier = false) => {
    const opening = Number(openingBalance) || 0;
    const debits = sumDebits(entries);
    const credits = sumCredits(entries);
    // For suppliers (AP/liability): Credits increase balance, Debits decrease balance
    // For customers (AR/asset): Debits increase balance, Credits decrease balance
    return isSupplier ? opening + credits - debits : opening + debits - credits;
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
    const refId = String(entry.referenceId || '').trim();
    if (!refId) {
      toast.error('Print not available for this row.');
      return;
    }
    setPrintLoading(true);
    setPrintData(null);
    try {
      const src = (entry.source || '').toLowerCase();
      if (src === 'sale' || src === 'sale_payment') {
        const result = await getOrderById(refId).unwrap();
        const order = result?.order || result?.data?.order || result;
        if (order) {
          setPrintDocumentTitle('Sales Invoice');
          setPrintPartyLabel('Customer');
          setPrintData(order);
          setShowPrintModal(true);
        } else {
          toast.error('Could not load sale for printing.');
        }
      } else if (src === 'cash_receipt') {
        const result = await getCashReceiptById(refId).unwrap();
        const receipt = result?.data || result;
        if (receipt) {
          setReceiptPrintTitle('Cash Receipt');
          setReceiptPrintData(receipt);
          setShowReceiptPrintModal(true);
        } else {
          toast.error('Could not load receipt for printing.');
        }
      } else if (src === 'bank_receipt') {
        const result = await getBankReceiptById(refId).unwrap();
        const receipt = result?.data || result;
        if (receipt) {
          setReceiptPrintTitle('Bank Receipt');
          setReceiptPrintData(receipt);
          setShowReceiptPrintModal(true);
        } else {
          toast.error('Could not load bank receipt for printing.');
        }
      } else if (src === 'purchase' || src === 'purchase_invoice' || src === 'purchase_invoice_payment') {
        const result = await getPurchaseInvoiceById(refId).unwrap();
        const invoice = result?.invoice || result?.data?.invoice || result?.data || result;
        if (invoice) {
          setPrintDocumentTitle('Purchase Invoice');
          setPrintPartyLabel('Supplier');
          setPrintData(invoice);
          setShowPrintModal(true);
        } else {
          toast.error('Could not load purchase invoice for printing.');
        }
      } else if (src === 'cash_payment' || src === 'bank_payment') {
        toast('Print this payment from Cash Payments or Bank Payments page.');
      } else if (entry.source === 'Sale Return') {
        const result = await getSaleReturnById(refId).unwrap();
        const saleReturn = result?.data || result;
        if (saleReturn) {
          setReturnPrintData(saleReturn);
          setShowReturnPrintModal(true);
        } else {
          toast.error('Could not load sale return for printing.');
        }
      } else if (entry.source === 'Purchase Return') {
        const result = await getPurchaseReturnById(refId).unwrap();
        const purchaseReturn = result?.data || result;
        if (purchaseReturn) {
          setReturnPrintData(purchaseReturn);
          setShowReturnPrintModal(true);
        } else {
          toast.error('Could not load purchase return for printing.');
        }
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

  const handleBackfillSales = async () => {
    try {
      const result = await postMissingSalesToLedger({
        dateFrom: filters.startDate,
        dateTo: filters.endDate
      }).unwrap();
      const posted = result?.posted ?? 0;
      const failed = result?.errors?.length ?? 0;
      toast.success(`Backfilled ${posted} sale(s).${failed ? ` ${failed} failed.` : ''}`);
      refetch();
    } catch (err) {
      handleApiError(err, 'Failed to backfill sales to ledger');
    }
  };

  const handleSyncSalesLedger = async () => {
    try {
      const result = await syncSalesLedger({
        dateFrom: filters.startDate,
        dateTo: filters.endDate
      }).unwrap();
      const updated = result?.updated ?? 0;
      const posted = result?.posted ?? 0;
      const failed = result?.errors?.length ?? 0;
      toast.success(`Synced ${updated} sale(s), posted ${posted}.${failed ? ` ${failed} failed.` : ''}`);
      refetch();
    } catch (err) {
      handleApiError(err, 'Failed to sync sales ledger');
    }
  };

  const handleSyncPurchaseLedger = async () => {
    try {
      const result = await syncPurchaseInvoicesLedger({
        dateFrom: filters.startDate,
        dateTo: filters.endDate
      }).unwrap();
      const updated = result?.updated ?? 0;
      const posted = result?.posted ?? 0;
      const failed = result?.errors?.length ?? 0;
      toast.success(`Synced ${updated} purchase invoice(s), posted ${posted}.${failed ? ` ${failed} failed.` : ''}`);
      refetch();
    } catch (err) {
      handleApiError(err, 'Failed to sync purchase invoices ledger');
    }
  };

  const customerName = selectedCustomerId
    ? (customerDetail?.customer?.name || detailedTransactionsData?.data?.customer?.name || 'Customer Receivables')
    : (supplierDetail?.supplier?.name || detailedSupplierTransactionsData?.data?.supplier?.name || 'Supplier Payables');

  const handleLedgerPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Account Ledger Summary - ${customerName}`,
    onBeforeGetContent: () => {
      if (!printRef.current) {
        toast.error('No content to print. Please select a customer or supplier.');
        return Promise.reject();
      }
      return Promise.resolve();
    }
  });

  const handlePrint = () => {
    if (!selectedCustomerId && !selectedSupplierId) {
      toast.error('Please select a customer or supplier to print.');
      return;
    }
    handleLedgerPrint();
  };

  // Early return for error (after all hooks)
  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading ledger summary</p>
          <Button onClick={() => refetch()} variant="default">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header - professional card */}
      <header className="bg-white border border-gray-200 rounded-lg shadow-sm px-6 py-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">Account Ledger Summary</h1>
            <p className="text-sm text-gray-500 mt-0.5">Customer receivables and supplier payables</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleSyncPurchaseLedger}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={isSyncPurchaseLoading}
              title="Sync purchase invoices ledger for this date range"
            >
              <FileText className="h-4 w-4" />
              {isSyncPurchaseLoading ? 'Syncing...' : 'Sync Purchase Ledger'}
            </Button>
            <Button
              onClick={handleSyncSalesLedger}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={isSyncLoading}
              title="Sync sales ledger for edited invoices in this date range"
            >
              <FileText className="h-4 w-4" />
              {isSyncLoading ? 'Syncing...' : 'Sync Sales Ledger'}
            </Button>
            <Button
              onClick={handleBackfillSales}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={isBackfillLoading}
              title="Post missing sales to ledger for the selected date range"
            >
              <FileText className="h-4 w-4" />
              {isBackfillLoading ? 'Backfilling...' : 'Backfill Sales'}
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={!selectedCustomerId && !selectedSupplierId}
              title={!selectedCustomerId && !selectedSupplierId ? 'Select a customer or supplier to print' : 'Print ledger summary'}
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </header>

      {/* Filters - clean card */}
      <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-4 uppercase tracking-wide">Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Customer Dropdown */}
          <div className="relative" ref={customerDropdownRef}>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Customer</label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Search or select..."
                value={customerSearchQuery}
                onChange={(e) => {
                  setCustomerSearchQuery(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                className="w-full h-9 border-gray-300 text-sm"
              />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                  {filteredCustomers.map((customer) => {
                    const businessName = customer.businessName || customer.business_name || customer.companyName || customer.company_name || '';
                    const displayName = businessName || customer.name || 'Unknown Customer';
                    return (
                      <button
                        key={getId(customer) ?? displayName}
                        onClick={() => handleCustomerSelect(customer)}
                        className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 last:border-0 hover:bg-gray-50 ${selectedCustomerId == getId(customer) ? 'bg-gray-100' : ''}`}
                      >
                        <div className="text-sm font-medium text-gray-900">{displayName}</div>
                        {businessName && customer.name && customer.name !== businessName && (
                          <div className="text-xs text-gray-500">{customer.name}</div>
                        )}
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
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Supplier</label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Search or select..."
                value={supplierSearchQuery}
                onChange={(e) => {
                  setSupplierSearchQuery(e.target.value);
                  setShowSupplierDropdown(true);
                }}
                onFocus={() => setShowSupplierDropdown(true)}
                className="w-full h-9 border-gray-300 text-sm"
              />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              {showSupplierDropdown && filteredSuppliers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                  {filteredSuppliers.map((supplier) => {
                    const displayName = supplier.companyName || supplier.company_name || supplier.name || 'Unknown Supplier';
                    return (
                      <button
                        key={getId(supplier) ?? displayName}
                        onClick={() => handleSupplierSelect(supplier)}
                        className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 last:border-0 hover:bg-gray-50 ${selectedSupplierId == getId(supplier) ? 'bg-gray-100' : ''}`}
                      >
                        <div className="text-sm font-medium text-gray-900">{displayName}</div>
                        {supplier.name && supplier.name !== displayName && (
                          <div className="text-xs text-gray-500">{supplier.name}</div>
                        )}
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

          {/* Date range */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Date range</label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="flex-1 min-w-0 h-9 border-gray-300 text-sm relative [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <span className="text-gray-400 shrink-0">–</span>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="flex-1 min-w-0 h-9 border-gray-300 text-sm relative [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
            </div>
          </div>

          {/* Clear */}
          <div className="flex items-end">
            <Button
              onClick={handleClearFilters}
              variant="outline"
              size="sm"
              className="w-full h-9 border-gray-300 text-gray-700"
            >
              Clear
            </Button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Customers Section - Show only if customer is selected and supplier is not */}
          {selectedCustomerId && !selectedSupplierId && (
            <div className="bg-white border border-emerald-200 rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-emerald-200 bg-emerald-50">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-200">
                    <Users className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {customerDetail?.customer?.name || detailedTransactionsData?.data?.customer?.name || 'Customer Receivables'}
                      </h2>
                      {showReturnColumn && (
                        <span className="text-sm text-gray-600">
                          Return total: {formatCurrency(customerDetail?.returnTotal ?? detailedTransactionsData?.data?.returnTotal ?? 0)}
                        </span>
                      )}
                    </div>
                    {filters.startDate && filters.endDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(filters.startDate)} – {formatDate(filters.endDate)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {detailedLoading ? (
                <div className="flex justify-center items-center py-16">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full account-ledger-table">
                    <thead>
                      <tr className="bg-emerald-600 border-b border-emerald-700">
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Voucher No</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Particular</th>
                        {showReturnColumn && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-20">Return</th>
                        )}
                        <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Debits</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Credits</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Balance</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider w-20 no-print">Print</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {/* Opening Balance Row */}
                      <tr className="bg-emerald-50/50">
                        <td className="px-4 py-3 text-sm text-gray-900"></td>
                        <td className="px-4 py-3 text-sm text-gray-900"></td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Opening Balance:</td>
                        {showReturnColumn && <td className="px-4 py-3 text-sm text-gray-900"></td>}
                        <td className="px-4 py-3 text-sm text-right text-gray-900"></td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900"></td>
                        <td className={`px-4 py-3 text-sm text-right font-bold ${((customerDetail?.openingBalance ?? detailedTransactionsData?.data?.openingBalance) || 0) < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                          {formatCurrency(customerDetail?.openingBalance ?? detailedTransactionsData?.data?.openingBalance ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center no-print"></td>
                      </tr>

                      {/* Transaction Rows */}
                      {(customerDetail?.entries ?? detailedTransactionsData?.data?.entries)?.length === 0 ? (
                        <tr>
                          <td colSpan={showReturnColumn ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p>No transactions found for this period</p>
                          </td>
                        </tr>
                      ) : (
                        (customerDetail?.entries ?? detailedTransactionsData?.data?.entries)?.map((entry, index) => (
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
                            {showReturnColumn && (
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {entry.source === 'Sale Return' ? 'Return' : ''}
                              </td>
                            )}
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
                              {entry.referenceId && entry.source && ['sale', 'Sale Return', 'cash_receipt', 'bank_receipt', 'sale_payment'].includes((entry.source || '').toString()) ? (
                                <button
                                  type="button"
                                  onClick={() => handlePrintEntry(entry)}
                                  disabled={printLoading}
                                  className="inline-flex items-center justify-center p-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                                  title={entry.source === 'Sale Return' ? 'Print return' : (entry.source === 'cash_receipt' || entry.source === 'bank_receipt') ? 'Print receipt' : 'Print sale invoice'}
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Return Total Row - shows when there are returns and return column is visible */}
                        {showReturnColumn &&
                        ((customerDetail?.entries ?? detailedTransactionsData?.data?.entries)?.length > 0) &&
                        (customerDetail?.returnTotal ?? detailedTransactionsData?.data?.returnTotal ?? 0) > 0 && (
                        <tr className="bg-emerald-100 font-medium">
                          <td className="px-4 py-3 text-sm text-gray-900"></td>
                          <td className="px-4 py-3 text-sm text-gray-900"></td>
                          <td className="px-4 py-3 text-sm text-gray-900">Return Total</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">Return</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">0</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatCurrency(customerDetail?.returnTotal ?? detailedTransactionsData?.data?.returnTotal ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900"></td>
                          <td className="px-4 py-3 text-center no-print"></td>
                        </tr>
                      )}

                      {/* Total Row */}
                      {(customerDetail?.entries ?? detailedTransactionsData?.data?.entries)?.length > 0 && (
                        <tr className="bg-emerald-200 font-semibold border-t-2 border-emerald-300">
                          <td className="px-4 py-3 text-sm text-gray-900"></td>
                          <td className="px-4 py-3 text-sm text-gray-900"></td>
                          <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                          {showReturnColumn && <td className="px-4 py-3 text-sm text-gray-900"></td>}
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatCurrency(sumDebits(customerDetail?.entries ?? detailedTransactionsData?.data?.entries))}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatCurrency(sumCredits(customerDetail?.entries ?? detailedTransactionsData?.data?.entries))}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-bold ${closingBalanceFromEntries(customerDetail?.openingBalance ?? detailedTransactionsData?.data?.openingBalance ?? 0, customerDetail?.entries ?? detailedTransactionsData?.data?.entries, false) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatCurrency(closingBalanceFromEntries(customerDetail?.openingBalance ?? detailedTransactionsData?.data?.openingBalance ?? 0, customerDetail?.entries ?? detailedTransactionsData?.data?.entries, false))}
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
            <div className="bg-white border border-blue-200 rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-blue-200 bg-blue-50">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-200">
                    <Building2 className="h-5 w-5 text-blue-700" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {supplierDetail?.supplier?.name || detailedSupplierTransactionsData?.data?.supplier?.name || 'Supplier Payables'}
                    </h2>
                    {filters.startDate && filters.endDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(filters.startDate)} – {formatDate(filters.endDate)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {detailedSupplierLoading ? (
                <div className="flex justify-center items-center py-16">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full account-ledger-table">
                    <thead>
                      <tr className="bg-blue-600 border-b border-blue-700">
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Voucher No</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Particular</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Debits</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Credits</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Balance</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider w-20 no-print">Print</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {/* Opening Balance Row */}
                      <tr className="bg-blue-50/50">
                        <td colSpan="3" className="px-4 py-3 text-sm font-medium text-gray-900">Opening Balance:</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">0</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">0</td>
                        <td className={`px-4 py-3 text-sm text-right font-bold ${(supplierDetail?.openingBalance ?? detailedSupplierTransactionsData?.data?.openingBalance ?? 0) < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                          {formatCurrency(supplierDetail?.openingBalance ?? detailedSupplierTransactionsData?.data?.openingBalance ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-center no-print"></td>
                      </tr>

                      {/* Transaction Entries */}
                      {(supplierDetail?.entries ?? detailedSupplierTransactionsData?.data?.entries)?.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p>No transactions found for this period</p>
                          </td>
                        </tr>
                      ) : (
                        (supplierDetail?.entries ?? detailedSupplierTransactionsData?.data?.entries)?.map((entry, index) => (
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
                              {entry.referenceId && entry.source && ['purchase', 'Purchase Return', 'purchase_invoice', 'purchase_invoice_payment'].includes((entry.source || '').toString()) ? (
                                <button
                                  type="button"
                                  onClick={() => handlePrintEntry(entry)}
                                  disabled={printLoading}
                                  className="inline-flex items-center justify-center p-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                                  title={entry.source === 'Purchase Return' ? 'Print return' : 'Print purchase invoice'}
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Total Row */}
                      {(supplierDetail?.entries ?? detailedSupplierTransactionsData?.data?.entries)?.length > 0 && (
                        <tr className="bg-blue-200 font-semibold border-t-2 border-blue-300">
                          <td className="px-4 py-3 text-sm text-gray-900"></td>
                          <td className="px-4 py-3 text-sm text-gray-900"></td>
                          <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatCurrency(sumDebits(supplierDetail?.entries ?? detailedSupplierTransactionsData?.data?.entries))}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatCurrency(sumCredits(supplierDetail?.entries ?? detailedSupplierTransactionsData?.data?.entries))}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-bold ${closingBalanceFromEntries(supplierDetail?.openingBalance ?? detailedSupplierTransactionsData?.data?.openingBalance ?? 0, supplierDetail?.entries ?? detailedSupplierTransactionsData?.data?.entries, true) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatCurrency(closingBalanceFromEntries(supplierDetail?.openingBalance ?? detailedSupplierTransactionsData?.data?.openingBalance ?? 0, supplierDetail?.entries ?? detailedSupplierTransactionsData?.data?.entries, true))}
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

          {!selectedCustomerId && !selectedSupplierId && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm py-20 px-6 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 mb-4">
                <FileText className="h-7 w-7 text-gray-400" />
              </div>
              <h3 className="text-base font-medium text-gray-900 mb-1">No ledger selected</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                Select a customer or supplier above to view their account ledger and transaction history.
              </p>
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

      {/* Receipt / Payment print modal – for Cash Receipt, Bank Receipt */}
      <ReceiptPaymentPrintModal
        isOpen={showReceiptPrintModal}
        onClose={() => {
          setShowReceiptPrintModal(false);
          setReceiptPrintData(null);
        }}
        documentTitle={receiptPrintTitle}
        receiptData={receiptPrintData}
      />

      {/* Return print modal – for Sale Return, Purchase Return */}
      <BasePrintModal
        isOpen={showReturnPrintModal}
        onClose={() => {
          setShowReturnPrintModal(false);
          setReturnPrintData(null);
        }}
        documentTitle={returnPrintData?.origin === 'purchase' ? 'Purchase Return' : 'Sale Return'}
        hasData={!!returnPrintData}
        emptyMessage="No return data to print."
      >
        <ReturnPrintContent
          returnData={returnPrintData}
          companyInfo={companyInfo}
          partyLabel={returnPrintData?.origin === 'purchase' ? 'Supplier' : 'Customer'}
        />
      </BasePrintModal>

      {/* Hidden Print Section - colored for customer (emerald) or supplier (blue) */}
      <div
        className={`hidden print:block account-ledger-print ${selectedCustomerId ? 'account-ledger-print--customer' : 'account-ledger-print--supplier'}`}
        ref={printRef}
      >
        <div className="print-header text-center mb-4">
          <h1 className="text-xl font-bold uppercase underline">Account Ledger Summary</h1>
          <p className="font-bold">
            {selectedCustomerId
              ? (customerDetail?.customer?.name || detailedTransactionsData?.data?.customer?.name || 'Customer Receivables')
              : (supplierDetail?.supplier?.name || detailedSupplierTransactionsData?.data?.supplier?.name || 'Supplier Payables')}
            {(selectedCustomerId ? (customerDetail?.customer?.accountCode ?? detailedTransactionsData?.data?.customer?.accountCode) : (supplierDetail?.supplier?.accountCode ?? detailedSupplierTransactionsData?.data?.supplier?.accountCode))
              ? ` - Account Code: ${selectedCustomerId ? (customerDetail?.customer?.accountCode ?? detailedTransactionsData?.data?.customer?.accountCode) : (supplierDetail?.supplier?.accountCode ?? detailedSupplierTransactionsData?.data?.supplier?.accountCode)}`
              : ''}
          </p>
          <p>Period: {formatDate(filters.startDate)} to {formatDate(filters.endDate)}</p>
        </div>

        <table className="account-ledger-print-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '10px' }}>
          <thead>
            <tr className="account-ledger-print-thead">
              <th style={{ width: '4%', border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>S.NO</th>
              <th style={{ width: '8%', border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>DATE</th>
              <th style={{ width: showReturnColumn ? '52%' : '60%', border: '1px solid #000', padding: '6px 2px', textAlign: 'left' }}>DESCRIPTION</th>
              {showReturnColumn && (
                <th style={{ width: '8%', border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>RETURN</th>
              )}
              <th className="print-amount" style={{ width: '8%', border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>DEBITS</th>
              <th className="print-amount" style={{ width: '8%', border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>CREDITS</th>
              <th className="print-amount" style={{ width: '8%', border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>BALANCE</th>
            </tr>
          </thead>
          <tbody>
            {/* Opening Balance */}
            <tr className="account-ledger-print-opening">
              <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>-</td>
              <td style={{ border: '1px solid #000', padding: '6px 2px' }}></td>
              <td style={{ border: '1px solid #000', padding: '6px 2px', fontWeight: 'bold', fontSize: '11px' }}>Opening Balance</td>
              {showReturnColumn && (
                <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}></td>
              )}
              <td className="print-amount" style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>0</td>
              <td className="print-amount" style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>0</td>
              <td className="print-amount" style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right', fontWeight: 'bold' }}>
                {formatCurrency(
                  (selectedCustomerId ? (customerDetail?.openingBalance ?? detailedTransactionsData?.data?.openingBalance) : (supplierDetail?.openingBalance ?? detailedSupplierTransactionsData?.data?.openingBalance)) ?? 0
                )}
              </td>
            </tr>

            {/* Transaction Rows */}
            {(selectedCustomerId ? (customerDetail?.entries ?? detailedTransactionsData?.data?.entries) : (supplierDetail?.entries ?? detailedSupplierTransactionsData?.data?.entries))?.map((entry, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>{index + 1}</td>
                <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>{formatDate(entry.date)}</td>
                <td style={{ border: '1px solid #000', padding: '6px 2px', fontSize: '12px' }}>
                  <span className="font-medium">{entry.particular || '-'}</span>
                  {entry.voucherNo && entry.voucherNo !== '-' && (
                    <span className="ml-1">
                      {entry.particular && entry.particular.toLowerCase().includes('sale') ? '#' : ''}:{entry.voucherNo}
                    </span>
                  )}
                </td>
                {showReturnColumn && (
                  <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>
                    {selectedCustomerId && entry.source === 'Sale Return' ? 'Return' : ''}
                  </td>
                )}
                <td className="print-amount" style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>
                  {entry.debitAmount > 0 ? formatCurrency(entry.debitAmount) : '0'}
                </td>
                <td className="print-amount" style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>
                  {entry.creditAmount > 0 ? formatCurrency(entry.creditAmount) : '0'}
                </td>
                <td className="print-amount" style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>
                  {formatCurrency(entry.balance || 0)}
                </td>
              </tr>
            ))}

            {/* Return Total Row - customer only, when there are returns and return column visible */}
            {showReturnColumn && selectedCustomerId && (customerDetail?.returnTotal ?? detailedTransactionsData?.data?.returnTotal ?? 0) > 0 && (
              <tr className="account-ledger-print-subtotal">
                <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}></td>
                <td style={{ border: '1px solid #000', padding: '6px 2px' }}></td>
                <td style={{ border: '1px solid #000', padding: '6px 2px', fontWeight: '600' }}>Return Total</td>
                <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center', fontWeight: '600' }}>Return</td>
                <td className="print-amount" style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>0</td>
                <td className="print-amount" style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>
                  {formatCurrency(customerDetail?.returnTotal ?? detailedTransactionsData?.data?.returnTotal ?? 0)}
                </td>
                <td className="print-amount" style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}></td>
              </tr>
            )}

            {/* Total Row */}
            <tr className="account-ledger-print-total">
              <td colSpan={showReturnColumn ? 4 : 3} style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center', fontSize: '15px' }}>Total</td>
              <td className="print-amount" style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right', fontSize: '15px', fontWeight: 'bold' }}>
                {formatCurrency(sumDebits(selectedCustomerId ? (customerDetail?.entries ?? detailedTransactionsData?.data?.entries) : (supplierDetail?.entries ?? detailedSupplierTransactionsData?.data?.entries)))}
              </td>
              <td className="print-amount" style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right', fontSize: '15px', fontWeight: 'bold' }}>
                {formatCurrency(sumCredits(selectedCustomerId ? (customerDetail?.entries ?? detailedTransactionsData?.data?.entries) : (supplierDetail?.entries ?? detailedSupplierTransactionsData?.data?.entries)))}
              </td>
              <td className="print-amount" style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right', fontSize: '15px', fontWeight: 'bold' }}>
                {formatCurrency(
                  selectedCustomerId
                    ? closingBalanceFromEntries(customerDetail?.openingBalance ?? detailedTransactionsData?.data?.openingBalance ?? 0, customerDetail?.entries ?? detailedTransactionsData?.data?.entries, false)
                    : closingBalanceFromEntries(supplierDetail?.openingBalance ?? detailedSupplierTransactionsData?.data?.openingBalance ?? 0, supplierDetail?.entries ?? detailedSupplierTransactionsData?.data?.entries, true)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
};

export default AccountLedgerSummary;
