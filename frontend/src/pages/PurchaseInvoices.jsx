import React, { useState } from 'react';
import {
  FileText,
  Search,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Printer,
  Calendar
} from 'lucide-react';
import {
  useGetPurchaseInvoicesQuery,
  useLazyGetPurchaseInvoiceQuery,
  useConfirmPurchaseInvoiceMutation,
  useDeletePurchaseInvoiceMutation,
  useExportExcelMutation,
  useExportCSVMutation,
  useExportPDFMutation,
  useExportJSONMutation,
  useDownloadFileMutation,
} from '../store/services/purchaseInvoicesApi';
import { useLazyGetSupplierQuery } from '../store/services/suppliersApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../components/ComponentRegistry';
import PrintModal from '../components/PrintModal';
import { Button } from '@/components/ui/button';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, formatDateForInput } from '../utils/dateUtils';

// Edit allowed only within 1 week of invoice date
const canEditByDate = (invoice) => {
  const raw = invoice?.invoiceDate ?? invoice?.invoice_date ?? invoice?.createdAt;
  if (raw == null) return false;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  cutoff.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d >= cutoff;
};

const StatusBadge = ({ status }) => {
  const statusConfig = {
    draft: { color: 'bg-gray-100 text-gray-800', icon: Clock, label: 'Draft' },
    confirmed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Confirmed' },
    received: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Received' },
    paid: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Paid' },
    cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Cancelled' },
    closed: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Closed' }
  };

  const config = statusConfig[status] || statusConfig.draft;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="h-3 w-3 mr-0.5 sm:mr-1" />
      {config.label}
    </span>
  );
};

const PurchaseInvoiceCard = ({ invoice, onEdit, onDelete, onConfirm, onView, onPrint }) => (
  <div className="card hover:shadow-lg transition-shadow">
    <div className="card-content">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="font-semibold text-gray-900">{invoice.invoiceNumber}</h3>
            <StatusBadge status={invoice.status} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center text-sm text-gray-600">
              <FileText className="h-4 w-4 mr-2" />
              {invoice.supplierInfo?.businessName || invoice.supplierInfo?.business_name || invoice.supplierInfo?.companyName || invoice.supplierInfo?.name || 'Unknown Supplier'}
            </div>

            <div className="flex items-center text-sm text-gray-600">
              <TrendingUp className="h-4 w-4 mr-2" />
              {Math.round(invoice.pricing?.total || 0)} ({invoice.items?.length || 0} items)
            </div>

            <div className="text-sm text-gray-500">
              {invoice.invoiceDate || invoice.invoice_date || invoice.createdAt 
                ? new Date(invoice.invoiceDate || invoice.invoice_date || invoice.createdAt).toLocaleDateString()
                : 'Invalid Date'}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onView(invoice)}
            className="text-gray-600 hover:text-gray-800"
            title="View Invoice"
          >
            <Eye className="h-4 w-4" />
          </button>

          <button
            onClick={() => onPrint && onPrint(invoice)}
            className="text-green-600 hover:text-green-800"
            title="Print Invoice"
          >
            <Printer className="h-4 w-4" />
          </button>

          {canEditByDate(invoice) && (
            <button
              onClick={() => onEdit(invoice)}
              className="text-blue-600 hover:text-blue-800"
              title="Edit Invoice"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}

          {/* Show delete button for all statuses except paid and closed */}
          {!['paid', 'closed'].includes(invoice.status) && (
            <button
              onClick={() => onDelete(invoice)}
              className="text-red-600 hover:text-red-800"
              title="Delete Invoice"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);

export const PurchaseInvoices = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const today = getCurrentDatePakistan();
  const [dateFrom, setDateFrom] = useState(today); // Today
  const [dateTo, setDateTo] = useState(today); // Today
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const { openTab } = useTab();

  // Build query params
  const queryParams = React.useMemo(() => {
    const params = {
      search: searchTerm || undefined,
      status: statusFilter || undefined,
    };

    if (dateFrom) {
      params.dateFrom = dateFrom;
    }
    if (dateTo) {
      params.dateTo = dateTo;
    }

    return params;
  }, [searchTerm, statusFilter, dateFrom, dateTo]);

  // Fetch purchase invoices
  const { data, isLoading, error, refetch } = useGetPurchaseInvoicesQuery(
    queryParams,
    { refetchOnMountOrArgChange: true }
  );

  // Editing occurs in Purchase page; no supplier query needed here

  const [getPurchaseInvoiceById] = useLazyGetPurchaseInvoiceQuery();

  // Mutations
  const [confirmPurchaseInvoiceMutation, { isLoading: confirming }] = useConfirmPurchaseInvoiceMutation();
  const [deletePurchaseInvoiceMutation, { isLoading: deleting }] = useDeletePurchaseInvoiceMutation();
  const [exportExcelMutation] = useExportExcelMutation();
  const [exportCSVMutation] = useExportCSVMutation();
  const [exportPDFMutation] = useExportPDFMutation();
  const [exportJSONMutation] = useExportJSONMutation();
  const [downloadFileMutation] = useDownloadFileMutation();

  const [getSupplierById] = useLazyGetSupplierQuery();

  // Print helper - fetch full invoice by ID, and fetch supplier if address is missing
  const handlePrint = async (invoice) => {
    if (!invoice) return;
    const id = invoice.id || invoice._id;
    if (id) {
      try {
        const result = await getPurchaseInvoiceById(id).unwrap();
        let fullInvoice = result?.invoice || result?.data?.invoice || result?.data || result;
        const supplierId = fullInvoice?.supplier_id || fullInvoice?.supplierId || fullInvoice?.supplier?.id || fullInvoice?.supplier?._id || fullInvoice?.supplierInfo?.id || fullInvoice?.supplierInfo?._id;
        const hasAddress = !!(fullInvoice?.supplierInfo?.address || fullInvoice?.supplier?.address);
        if (!hasAddress && supplierId && typeof supplierId === 'string') {
          try {
            const supResult = await getSupplierById(supplierId).unwrap();
            const supplier = supResult?.supplier || supResult?.data?.supplier || supResult;
            if (supplier) {
              let addr = '';
              if (typeof supplier.address === 'string' && supplier.address.trim()) addr = supplier.address.trim();
              else if (Array.isArray(supplier.address) && supplier.address.length > 0) {
                const a = supplier.address.find(x => x.isDefault) || supplier.address.find(x => x.type === 'billing' || x.type === 'both') || supplier.address[0];
                const parts = [a.street || a.address_line1 || a.addressLine1, a.city, a.state || a.province, a.country, a.zipCode || a.zip].filter(Boolean);
                addr = parts.join(', ');
              } else if (supplier.address && typeof supplier.address === 'object') {
                const a = supplier.address;
                const parts = [a.street || a.address_line1 || a.addressLine1 || a.line1, a.address_line2 || a.addressLine2, a.city, a.state || a.province, a.country, a.zipCode || a.zip || a.postal_code].filter(Boolean);
                addr = parts.join(', ');
              } else if (supplier.addresses?.length) {
                const a = supplier.addresses.find(x => x.isDefault) || supplier.addresses.find(x => x.type === 'billing' || x.type === 'both') || supplier.addresses[0];
                addr = [a.street || a.address_line1 || a.addressLine1, a.city, a.state || a.province, a.country, a.zipCode || a.zip].filter(Boolean).join(', ');
              }
              if (addr) {
                fullInvoice = {
                  ...fullInvoice,
                  supplierInfo: { ...(fullInvoice.supplierInfo || {}), address: addr },
                  supplier: typeof fullInvoice.supplier === 'object' ? { ...fullInvoice.supplier, address: addr } : fullInvoice.supplier
                };
              }
            }
          } catch (e) { /* ignore */ }
        }
        setSelectedInvoice(fullInvoice || invoice);
      } catch {
        setSelectedInvoice(invoice);
      }
    } else {
      setSelectedInvoice(invoice);
    }
    setShowViewModal(true);
  };

  // Table columns configuration
  const columns = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      accessor: (item) => item.invoiceNumber,
      render: (value, item) => (
        <div className="font-medium text-gray-900">{value}</div>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      accessor: (item) => item.supplierInfo?.companyName || item.supplierInfo?.name || 'Unknown',
      render: (value, item) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">
            {item.invoiceDate || item.invoice_date || item.createdAt 
              ? new Date(item.invoiceDate || item.invoice_date || item.createdAt).toLocaleDateString()
              : 'Invalid Date'}
          </div>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      accessor: (item) => item.pricing?.total || 0,
      render: (value, item) => (
        <div className="text-right">
          <div className="font-semibold text-gray-900">{Math.round(value)}</div>
          <div className="text-sm text-gray-500">{item.items?.length || 0} items</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (item) => item.status,
      render: (value, item) => <StatusBadge status={value} />,
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      accessor: (item) => item.payment?.status || 'pending',
      render: (value, item) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value === 'paid' ? 'bg-green-100 text-green-800' :
          value === 'partial' ? 'bg-yellow-100 text-yellow-800' :
            value === 'overdue' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
          }`}>
          {value}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: () => '',
      render: (value, item) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleView(item)}
            className="text-gray-600 hover:text-gray-800"
            title="View Invoice"
          >
            <Eye className="h-4 w-4" />
          </button>

          <button
            onClick={() => handlePrint(item)}
            className="text-green-600 hover:text-green-800"
            title="Print Invoice"
          >
            <Printer className="h-4 w-4" />
          </button>

          {canEditByDate(item) && (
            <button
              onClick={() => handleEdit(item)}
              className="text-blue-600 hover:text-blue-800"
              title="Edit Invoice"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}

          {/* Show delete button for all statuses except paid and closed */}
          {!['paid', 'closed'].includes(item.status) && (
            <button
              onClick={() => handleDelete(item)}
              className="text-red-600 hover:text-red-800"
              title="Delete Invoice"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Event handlers
  const handleConfirm = (invoice) => {
    if (window.confirm(`Are you sure you want to confirm invoice ${invoice.invoiceNumber}?`)) {
      confirmPurchaseInvoiceMutation(invoice._id)
        .unwrap()
        .then(() => {
          showSuccessToast('Purchase invoice confirmed successfully');
          refetch();
        })
        .catch((error) => {
          handleApiError(error, 'Purchase Invoice Confirmation');
        });
    }
  };

  const handleDelete = (invoice) => {
    const message = invoice.status === 'confirmed'
      ? `Are you sure you want to delete invoice ${invoice.invoiceNumber}?\n\nThis will:\n• Remove ${invoice.items?.length || 0} products from inventory\n• Reduce supplier balance by ${Math.round((invoice.pricing?.total || 0) - (invoice.payment?.amount || 0))}`
      : `Are you sure you want to delete invoice ${invoice.invoiceNumber}?`;

    if (window.confirm(message)) {
      deletePurchaseInvoiceMutation(invoice._id)
        .unwrap()
        .then(() => {
          showSuccessToast('Purchase invoice deleted successfully');
          refetch();
        })
        .catch((error) => {
          handleApiError(error, 'Purchase Invoice Deletion');
        });
    }
  };

  const handleEdit = (invoice) => {
    // Get component info for Purchase page
    const componentInfo = getComponentInfo('/purchase');
    if (componentInfo) {
      // Create a new tab for editing the purchase invoice
      const newTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Prepare the invoice data to pass to the Purchase page
      const invoiceData = {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        supplier: invoice.supplierInfo,
        items: invoice.items || [],
        notes: invoice.notes || '',
        invoiceType: invoice.invoiceType || 'purchase',
        invoiceDate: invoice.invoiceDate || invoice.createdAt, // Include invoiceDate for editing
        createdAt: invoice.createdAt, // Include createdAt as fallback
        isEditMode: true,
        payment: invoice.payment || {} // Include payment for amount paid editing
      };

      openTab({
        title: `Edit Purchase - ${invoice.invoiceNumber}`,
        path: '/purchase',
        component: componentInfo.component,
        icon: componentInfo.icon,
        allowMultiple: true,
        props: {
          tabId: newTabId,
          editData: invoiceData
        }
      });

      showSuccessToast(`Opening ${invoice.invoiceNumber} for editing...`);
    } else {
      showErrorToast('Purchase page not found');
    }
  };

  const handleView = (invoice) => {
    setSelectedInvoice(invoice);
    setShowViewModal(true);
  };

  const handleExport = async (format = 'csv') => {
    try {
      const payload = {
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
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
          ? 'purchase_invoices.xlsx'
          : format === 'pdf'
            ? 'purchase_invoices.pdf'
            : format === 'json'
              ? 'purchase_invoices.json'
              : 'purchase_invoices.csv');

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
      showSuccessToast(`Exported purchase invoices as ${format.toUpperCase()}`);
    } catch (error) {
      handleApiError(error, 'Purchase Invoice Export');
    }
  };

  // Memoize invoices data - must be before conditional returns to follow Rules of Hooks
  const invoices = React.useMemo(() => {
    if (!data) return [];
    if (data?.data?.invoices) return data.data.invoices;
    if (data?.invoices) return data.invoices;
    if (data?.data?.data?.invoices) return data.data.data.invoices;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }, [data]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="text-center py-8 sm:py-12 px-4">
        <p className="text-sm sm:text-base text-red-600">Failed to load purchase invoices</p>
        <Button onClick={refetch} variant="default" size="default" className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Purchase Invoices</h1>
          <p className="text-sm sm:text-base text-gray-600">Track and manage supplier invoices and receipts</p>
        </div>
        
        {/* Date Filter using DateFilter component */}
        <div className="w-full sm:w-auto">
          <DateFilter
            startDate={dateFrom}
            endDate={dateTo}
            onDateChange={(start, end) => {
              setDateFrom(start || '');
              setDateTo(end || '');
            }}
            compact={true}
            showPresets={true}
            className="w-full"
          />
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3 sm:space-y-4">
        {/* Search and Status Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice number, supplier name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full text-sm sm:text-base"
            />
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto sm:min-w-[140px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-full text-sm sm:text-base"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
              <option value="received">Received</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Purchase Invoices Table */}
      {invoices.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <FileText className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No purchase invoices found</h3>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 px-4">
            {searchTerm || statusFilter || dateFrom || dateTo ? 'Try adjusting your filters.' : 'No purchase invoices have been created yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Header - Desktop Only */}
          <div className="hidden md:block bg-gray-50 px-4 lg:px-6 py-3 border-b border-gray-200">
            <div className="grid grid-cols-12 gap-3 lg:gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-1">Invoice #</div>
              <div className="col-span-3">Supplier</div>
              <div className="col-span-1">Date</div>
              <div className="col-span-1">Items</div>
              <div className="col-span-1">Total</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Payment</div>
              <div className="col-span-1">Notes</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-200">
            {invoices.map((invoice) => (
              <div key={invoice._id} className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors">
                {/* Mobile Card Layout */}
                <div className="md:hidden space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-gray-900 truncate">{invoice.invoiceNumber}</h3>
                        <StatusBadge status={invoice.status} />
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {invoice.supplierInfo?.businessName || invoice.supplierInfo?.business_name || invoice.supplierInfo?.companyName || invoice.supplierInfo?.name || 'Unknown Supplier'}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>{invoice.invoiceDate || invoice.invoice_date || invoice.createdAt 
                          ? new Date(invoice.invoiceDate || invoice.invoice_date || invoice.createdAt).toLocaleDateString()
                          : 'Invalid Date'}</span>
                        <span>•</span>
                        <span>{invoice.items?.length || 0} items</span>
                      </div>
                    </div>
                    <div className="flex items-center flex-nowrap gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleView(invoice)}
                        className="shrink-0 text-gray-600 hover:text-gray-800 p-1"
                        title="View Invoice"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handlePrint(invoice)}
                        className="shrink-0 text-green-600 hover:text-green-800 p-1"
                        title="Print Invoice"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      {canEditByDate(invoice) && (
                        <button
                          onClick={() => handleEdit(invoice)}
                          className="shrink-0 text-blue-600 hover:text-blue-800 p-1"
                          title="Edit Invoice"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {!['paid', 'closed'].includes(invoice.status) && (
                        <button
                          onClick={() => handleDelete(invoice)}
                          className="shrink-0 text-red-600 hover:text-red-800 p-1"
                          title="Delete Invoice"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div>
                      <span className="text-xs text-gray-500">Payment:</span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ml-1 ${invoice.payment?.status === 'paid' ? 'bg-green-100 text-green-800' :
                        invoice.payment?.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          invoice.payment?.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                        {invoice.payment?.status || 'pending'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">Total:</span>
                      <p className="font-semibold text-sm text-gray-900">{Math.round(invoice.pricing?.total || 0)}</p>
                    </div>
                  </div>
                  {invoice.notes?.trim() && (
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">Notes: </span>
                      <span className="text-xs text-gray-600">{invoice.notes.trim()}</span>
                    </div>
                  )}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden md:grid grid-cols-12 gap-3 lg:gap-4 items-center">
                  {/* Invoice Number */}
                  <div className="col-span-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {invoice.invoiceNumber}
                    </div>
                  </div>

                  {/* Supplier */}
                  <div className="col-span-3 min-w-0">
                    <div className="text-sm text-gray-900 truncate" title={invoice.supplierInfo?.businessName || invoice.supplierInfo?.business_name || invoice.supplierInfo?.companyName || invoice.supplierInfo?.name || 'Unknown Supplier'}>
                      {invoice.supplierInfo?.businessName || invoice.supplierInfo?.business_name || invoice.supplierInfo?.companyName || invoice.supplierInfo?.name || 'Unknown Supplier'}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="col-span-1">
                    <span className="text-xs sm:text-sm text-gray-600">
                      {invoice.invoiceDate || invoice.invoice_date || invoice.createdAt 
                        ? new Date(invoice.invoiceDate || invoice.invoice_date || invoice.createdAt).toLocaleDateString()
                        : 'Invalid Date'}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="col-span-1">
                    <span className="text-xs sm:text-sm text-gray-600">
                      {invoice.items?.length || 0}
                    </span>
                  </div>

                  {/* Total */}
                  <div className="col-span-1">
                    <span className="font-semibold text-sm text-gray-900">
                      {Math.round(invoice.pricing?.total || 0)}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-1">
                    <StatusBadge status={invoice.status} />
                  </div>

                  {/* Payment */}
                  <div className="col-span-1">
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${invoice.payment?.status === 'paid' ? 'bg-green-100 text-green-800' :
                      invoice.payment?.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                        invoice.payment?.status === 'overdue' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                      }`}>
                      {invoice.payment?.status || 'pending'}
                    </span>
                  </div>

                  {/* Notes */}
                  <div className="col-span-1">
                    <span
                      className="text-xs text-gray-600 block truncate"
                      title={invoice.notes?.trim() || 'No notes'}
                    >
                      {invoice.notes?.trim() || '—'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex justify-end">
                    <div className="flex items-center flex-nowrap gap-1">
                      <button
                        onClick={() => handleView(invoice)}
                        className="shrink-0 text-gray-600 hover:text-gray-800 p-1"
                        title="View Invoice"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handlePrint(invoice)}
                        className="shrink-0 text-green-600 hover:text-green-800 p-1"
                        title="Print Invoice"
                      >
                        <Printer className="h-4 w-4" />
                      </button>

                      {canEditByDate(invoice) && (
                        <button
                          onClick={() => handleEdit(invoice)}
                          className="shrink-0 text-blue-600 hover:text-blue-800 p-1"
                          title="Edit Invoice"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}

                      {/* Show delete button for all statuses except paid and closed */}
                      {!['paid', 'closed'].includes(invoice.status) && (
                        <button
                          onClick={() => handleDelete(invoice)}
                          className="shrink-0 text-red-600 hover:text-red-800 p-1"
                          title="Delete Invoice"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* View Modal with Print Support */}
      <PrintModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        orderData={selectedInvoice ? {
          ...selectedInvoice,
          supplier: selectedInvoice.supplierInfo || selectedInvoice.supplier,
          supplierInfo: { ...(selectedInvoice.supplierInfo || {}), address: selectedInvoice.supplierInfo?.address || selectedInvoice.supplier?.address }
        } : null}
        documentTitle="Purchase Invoice"
        partyLabel="Supplier"
      />

      {/* Edit modal removed: editing handled via opening /purchase tab */}
    </div>
  );
};
