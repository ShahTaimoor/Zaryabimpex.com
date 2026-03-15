import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search,
} from 'lucide-react';
import {
  useGetCustomersQuery,
} from '../store/services/customersApi';
import { LoadingPage } from '../components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';
import CustomerImportExport from '../components/CustomerImportExport';
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
        <div className="flex-shrink-0 w-full sm:w-auto">
          <Button
            onClick={() => customerOps.setIsModalOpen(true)}
            variant="default"
            size="default"
            className="flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add Customer
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

      {/* Import/Export Section */}
      <CustomerImportExport 
        onImportComplete={() => refetch()}
        filters={{ ...queryParams, limit: 999999, page: 1 }}
      />

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
