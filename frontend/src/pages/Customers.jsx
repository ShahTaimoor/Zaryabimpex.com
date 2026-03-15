import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Users,
} from 'lucide-react';
import {
  useGetCustomersQuery,
} from '../store/services/customersApi';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { LoadingPage } from '../components/LoadingSpinner';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';
import CustomerImportExport from '../components/CustomerImportExport';
import CustomerFilters from '../components/CustomerFilters';
import NotesPanel from '../components/NotesPanel';
import { CustomerFormModal } from '../components/CustomerFormModal';
import { CustomerList } from '../components/CustomerList';
import { useCustomerOperations } from '../hooks/useCustomerOperations';

export const Customers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({});
  const [showNotes, setShowNotes] = useState(false);
  const [notesEntity, setNotesEntity] = useState(null);

  const queryParams = { 
    search: searchTerm,
    limit: 999999,
    ...filters
  };

  const { data, isLoading, error, refetch } = useGetCustomersQuery(queryParams, {
    refetchOnMountOrArgChange: true,
  });

  const { confirmation, confirmDelete, handleConfirm, handleCancel } = useDeleteConfirmation();

  const customerOps = useCustomerOperations(refetch);

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  // Get all customers from API
  const allCustomers = data?.data?.customers || data?.customers || [];
  
  // Apply fuzzy search on client side for better UX
  // Hook must be called before any early returns
  const customers = useFuzzySearch(
    allCustomers,
    searchTerm,
    ['name', 'businessName', 'email', 'phone', 'displayName'],
    {
      threshold: 0.4,
      minScore: 0.3,
      limit: null // Show all matches
    }
  );

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
          <button
            onClick={() => customerOps.setIsModalOpen(true)}
            className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Import/Export Section */}
      <CustomerImportExport 
        onImportComplete={() => refetch()}
        filters={queryParams}
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
          setNotesEntity({ type: 'Customer', id: customer._id, name: customer.businessName || customer.name });
          setShowNotes(true);
        }}
      />

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
