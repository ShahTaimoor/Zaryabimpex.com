import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  Download,
} from 'lucide-react';
import {
  useGetCustomersQuery,
  useBulkCreateCustomersMutation,
} from '../store/services/customersApi';
import { LoadingPage } from '../components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ExcelExportButton from '../components/ExcelExportButton';
import PdfExportButton from '../components/PdfExportButton';
import ExcelImportButton from '../components/ExcelImportButton';
import { exportTemplate } from '../utils/excelExport';
import { toast } from 'sonner';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';

import CustomerFilters from '../components/CustomerFilters';
import NotesPanel from '../components/NotesPanel';
import { CustomerFormModal } from '../components/CustomerFormModal';
import { CustomerList } from '../components/CustomerList';
import { useCustomerOperations } from '../hooks/useCustomerOperations';

const LIMIT_OPTIONS = [50, 500, 1000, 5000];
const DEFAULT_LIMIT = 50;

export const Customers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_LIMIT);
  const [filters, setFilters] = useState({});
  const [showNotes, setShowNotes] = useState(false);
  const [notesEntity, setNotesEntity] = useState(null);

  const queryParams = {
    search: searchTerm || undefined,
    page: currentPage,
    limit: itemsPerPage,
    ...filters
  };

  const { data, isLoading, error, refetch } = useGetCustomersQuery(queryParams, {
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, JSON.stringify(filters)]);

  const { confirmation, confirmDelete, handleConfirm, handleCancel } = useDeleteConfirmation();

  const customerOps = useCustomerOperations(refetch);

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  const handleLimitChange = (e) => {
    const val = Number(e.target.value);
    setItemsPerPage(val);
    setCurrentPage(1);
  };

  const customers = useMemo(() => {
    return data?.data?.customers || data?.customers || [];
  }, [data]);

  const pagination = useMemo(() => {
    const raw = data?.pagination || data?.data?.pagination || {};
    return {
      current: raw.current ?? raw.page ?? 1,
      pages: raw.pages ?? 1,
      total: raw.total ?? 0,
      limit: raw.limit ?? itemsPerPage,
      hasPrev: (raw.current ?? raw.page ?? 1) > 1,
      hasNext: (raw.current ?? raw.page ?? 1) < (raw.pages ?? 1),
    };
  }, [data, itemsPerPage]);

  const getExportData = () => ({
    title: 'Customer Directory',
    filename: `Customers_${new Date().toLocaleDateString()}.xlsx`,
    columns: [
      { header: 'Business Name', key: 'businessName', width: 35 },
      { header: 'Contact Person', key: 'contactPersonName', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Address', key: 'fullAddress', width: 40 },
      { header: 'City', key: 'city', width: 15 },
      { header: 'Balance', key: 'currentBalance', width: 15, type: 'currency' }
    ],
    data: customers.map(c => {
      const addr = Array.isArray(c.address) ? (c.address[0] || {}) : (c.address || {});
      const street = addr.street || '';
      const city = addr.city || c.city || '';
      return {
        ...c,
        businessName: c.businessName || c.business_name || c.name || '',
        contactPersonName: c.contactPerson?.name || c.contact_person || c.name || '',
        city,
        fullAddress: [street, city].filter(Boolean).join(', '),
        currentBalance: c.currentBalance ?? c.balance ?? 0,
        phone: c.phone || c.contact_phone || ''
      };
    })
  });

  const handleDownloadTemplate = () => {
    exportTemplate({
      title: 'Customer Import Template',
      filename: 'Customer_Template.xlsx',
      columns: [
        { header: 'Business Name', key: 'businessName', width: 35 },
        { header: 'Contact Person', key: 'contactPerson', width: 25 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Phone', key: 'phone', width: 20 },
        { header: 'Address', key: 'address', width: 35 },
        { header: 'City', key: 'city', width: 15 },
        { header: 'Opening Balance', key: 'balance', width: 15, type: 'currency' }
      ]
    });
  };

  const [bulkCreateCustomers] = useBulkCreateCustomersMutation();
  const [autoCreateImportCities, setAutoCreateImportCities] = useState(true);

  const handleImportData = async (data) => {
    if (!data || data.length === 0) return;

    const toastId = toast.loading(`Saving ${data.length} customers to database...`);
    try {
      const response = await bulkCreateCustomers({
        customers: data,
        autoCreateCities: autoCreateImportCities
      }).unwrap();
      if (response.created > 0) {
        toast.success(`Successfully imported ${response.created} customers!`, { id: toastId });
        if (response.failed > 0) {
          toast.warning(`${response.failed} customers failed. Check console for details.`);
          console.warn('Import failures:', response.errors);
        }
      } else {
        toast.error('Failed to import customers. Check file format.', { id: toastId });
      }
    } catch (error) {
      console.error('Bulk Import Error:', error);
      toast.error(error.data?.message || 'Error occurred while saving customers.', { id: toastId });
    }
  };

  if (isLoading) {
    return <LoadingPage message="Loading customers..." />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-danger-600">Failed to load customers</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full ">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage your customer database</p>
        </div>
        <div className="flex-shrink-0 flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={() => customerOps.handleAdd()}
            variant="default"
            size="default"
            className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white transition-all shadow-md active:scale-95 px-6 font-bold tracking-tight"
          >
            <Plus className="h-4 w-4" />
            <span className="uppercase">ADD CUSTOMER</span>
          </Button>
          <ExcelExportButton getData={getExportData} label="Export" />
          <PdfExportButton getData={getExportData} label="PDF" />
          <ExcelImportButton onDataImported={handleImportData} label="Import" />
          <label className="inline-flex items-center gap-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
            <input
              type="checkbox"
              checked={autoCreateImportCities}
              onChange={(e) => setAutoCreateImportCities(e.target.checked)}
              className="h-4 w-4"
            />
            Auto-create city
          </label>
          <Button
            onClick={handleDownloadTemplate}
            variant="outline"
            size="sm"
            className="group flex items-center justify-center gap-2 border-orange-200 bg-white text-orange-600 hover:bg-orange-50 hover:border-orange-500 h-9 px-3 rounded-lg shadow-sm transition-all duration-200"
          >
            <Download className="h-3.5 w-3.5 group-hover:-translate-y-0.5 transition-transform" />
            <span className="text-xs font-semibold tracking-tight uppercase">Template</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 relative min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <label htmlFor="customers-limit" className="text-sm text-gray-600 whitespace-nowrap">Show:</label>
          <select
            id="customers-limit"
            value={itemsPerPage}
            onChange={handleLimitChange}
            className="input text-sm py-2 pr-8 pl-3 min-w-[80px]"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>



      {/* Advanced Filters */}
      <CustomerFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
      />

      <CustomerList
        customers={customers}
        searchTerm={searchTerm}
        onEdit={customerOps.handleEdit}
        onDelete={(customer) => customerOps.handleDelete(customer, confirmDelete)}
        onShowNotes={(customer) => {
          setNotesEntity({ type: 'Customer', id: customer._id || customer.id, name: customer.businessName || customer.name });
          setShowNotes(true);
        }}
      />

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Showing{' '}
            <span className="font-medium">
              {(pagination.current - 1) * pagination.limit + 1}
            </span>
            {' - '}
            <span className="font-medium">
              {Math.min(pagination.current * pagination.limit, pagination.total)}
            </span>
            {' of '}
            <span className="font-medium">{pagination.total}</span>
            {' customers'}
          </p>
          <nav className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrev}
              variant="outline"
              size="sm"
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600 px-2">
              Page {pagination.current} of {pagination.pages}
            </span>
            <Button
              onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={!pagination.hasNext}
              variant="outline"
              size="sm"
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </Button>
          </nav>
        </div>
      )}

      {customerOps.isModalOpen && (
        <CustomerFormModal
          customer={customerOps.selectedCustomer}
          onSave={customerOps.handleSave}
          onCancel={customerOps.handleCloseModal}
          isSubmitting={customerOps.creating || customerOps.updating}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={confirmation.isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        itemName={confirmation.message?.match(/"([^"]*)"/)?.[1] || ''}
        itemType="Customer"
        isLoading={customerOps.deleting}
      />

      {/* Notes Panel */}
      {showNotes && notesEntity && (
        <NotesPanel
          entityType={notesEntity.type}
          entityId={notesEntity.id}
          entityName={notesEntity.name}
          onClose={() => {
            setShowNotes(false);
            setNotesEntity(null);
          }}
        />
      )}
    </div>
  );
};
