import React, { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Warehouse,
  Plus,
  Search,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Mail,
  StickyNote,
  User,
  Flag,
  Hash,
  Layers,
  CheckCircle,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useGetWarehousesQuery,
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
  useDeleteWarehouseMutation,
} from '../store/services/warehousesApi';
import {
  LoadingPage,
  LoadingCard,
  LoadingSpinner,
  LoadingButton,
} from '../components/LoadingSpinner';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';

const defaultFormValues = {
  name: '',
  code: '',
  description: '',
  address: {
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  },
  contact: {
    name: '',
    phone: '',
    email: '',
  },
  capacity: '',
  isPrimary: false,
  isActive: true,
  notes: '',
};

const sanitizePayload = (payload) => {
  const sanitized = { ...payload };

  sanitized.code = sanitized.code?.trim().toUpperCase();
  sanitized.name = sanitized.name?.trim();
  sanitized.description = sanitized.description?.trim() || undefined;
  sanitized.notes = sanitized.notes?.trim() || undefined;

  if (sanitized.capacity === '' || sanitized.capacity === null) {
    delete sanitized.capacity;
  } else {
    sanitized.capacity = Number(sanitized.capacity);
  }

  if (sanitized.address) {
    const cleanedAddress = Object.fromEntries(
      Object.entries(sanitized.address).map(([key, value]) => [key, value?.trim() || undefined])
    );
    if (Object.values(cleanedAddress).every((value) => !value)) {
      delete sanitized.address;
    } else {
      sanitized.address = cleanedAddress;
    }
  }

  if (sanitized.contact) {
    const cleanedContact = Object.fromEntries(
      Object.entries(sanitized.contact).map(([key, value]) => [key, value?.trim() || undefined])
    );
    if (Object.values(cleanedContact).every((value) => !value)) {
      delete sanitized.contact;
    } else {
      sanitized.contact = cleanedContact;
    }
  }

  return sanitized;
};

const WarehouseFormModal = ({ warehouse, onSave, onCancel, isSubmitting }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (warehouse) {
      reset({
        ...defaultFormValues,
        ...warehouse,
        capacity: warehouse.capacity ?? '',
        address: {
          ...defaultFormValues.address,
          ...(warehouse.address || {}),
        },
        contact: {
          ...defaultFormValues.contact,
          ...(warehouse.contact || {}),
        },
      });
    } else {
      reset(defaultFormValues);
    }
  }, [warehouse, reset]);

  const onSubmit = (values) => {
    const payload = sanitizePayload(values);
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-6">
          <div className="flex items-center space-x-3">
            <Warehouse className="h-6 w-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {warehouse ? 'Edit Warehouse' : 'Add Warehouse'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 transition hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="form-label flex items-center space-x-2">
                <Hash className="h-4 w-4 text-gray-400" />
                <span>Name *</span>
              </label>
              <input
                {...register('name', { required: 'Warehouse name is required' })}
                className="input"
                placeholder="Main Warehouse"
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div>
              <label className="form-label flex items-center space-x-2">
                <Layers className="h-4 w-4 text-gray-400" />
                <span>Code *</span>
              </label>
              <input
                {...register('code', {
                  required: 'Warehouse code is required',
                  maxLength: { value: 50, message: 'Maximum 50 characters' },
                })}
                className="input uppercase"
                placeholder="MAIN"
              />
              {errors.code && <p className="mt-1 text-sm text-red-500">{errors.code.message}</p>}
            </div>
          </div>

          <div>
            <label className="form-label flex items-center space-x-2">
              <StickyNote className="h-4 w-4 text-gray-400" />
              <span>Description</span>
            </label>
            <textarea
              {...register('description', { maxLength: { value: 500, message: 'Max 500 characters' } })}
              className="input"
              rows={3}
              placeholder="Short description about warehouse purpose or coverage"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="form-label flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>Address Line 1</span>
              </label>
              <input
                {...register('address.line1')}
                className="input"
                placeholder="Street, number..."
              />
            </div>
            <div>
              <label className="form-label flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>Address Line 2</span>
              </label>
              <input
                {...register('address.line2')}
                className="input"
                placeholder="Suite, building..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="form-label">City</label>
              <input {...register('address.city')} className="input" />
            </div>
            <div>
              <label className="form-label">State/Province</label>
              <input {...register('address.state')} className="input" />
            </div>
            <div>
              <label className="form-label">Postal Code</label>
              <input {...register('address.postalCode')} className="input" />
            </div>
            <div>
              <label className="form-label flex items-center space-x-2">
                <Flag className="h-4 w-4 text-gray-400" />
                <span>Country</span>
              </label>
              <input {...register('address.country')} className="input" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="form-label flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-400" />
                <span>Contact Person</span>
              </label>
              <input {...register('contact.name')} className="input" placeholder="Person in charge" />
            </div>
            <div>
              <label className="form-label flex items-center space-x-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>Phone</span>
              </label>
              <input {...register('contact.phone')} className="input" placeholder="+1 555 123 4567" />
            </div>
            <div>
              <label className="form-label flex items-center space-x-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>Email</span>
              </label>
              <input
                {...register('contact.email', {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Please enter a valid email address',
                  },
                })}
                className="input"
                placeholder="contact@example.com"
              />
              {errors.contact?.email && (
                <p className="mt-1 text-sm text-red-500">{errors.contact.email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="form-label">Storage Capacity (optional)</label>
              <input
                type="number"
                min="0"
                step="1"
                {...register('capacity', {
                  min: { value: 0, message: 'Capacity must be zero or higher' },
                })}
                className="input"
                placeholder="Units or pallets"
              />
              {errors.capacity && (
                <p className="mt-1 text-sm text-red-500">{errors.capacity.message}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" {...register('isPrimary')} className="checkbox" />
              <div>
                <p className="text-sm font-medium text-gray-700">Primary Warehouse</p>
                <p className="text-xs text-gray-500">
                  Marks this warehouse as default for new inventory records.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" {...register('isActive')} className="checkbox" />
              <div>
                <p className="text-sm font-medium text-gray-700">Active</p>
                <p className="text-xs text-gray-500">
                  Inactive warehouses will be hidden from selection lists.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea
              {...register('notes')}
              className="input"
              rows={3}
              placeholder="Internal notes or handling instructions"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 border-t pt-4">
            <button type="button" className="btn btn-secondary btn-md" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-md" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoadingButton />
              ) : (
                <span className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>{warehouse ? 'Update Warehouse' : 'Create Warehouse'}</span>
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Warehouses = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);

  const { confirmDelete, deleteDialog } = useDeleteConfirmation();

  const { data: warehousesResponse, isLoading, error, isFetching, refetch: refetchWarehouses } = useGetWarehousesQuery(
    {
      search: searchTerm || undefined,
      isActive: showActiveOnly ? 'true' : undefined,
      limit: 100,
    }
  );

  // Extract warehouses array from response
  const warehouses = React.useMemo(() => {
    if (!warehousesResponse) return [];
    if (warehousesResponse?.data?.data?.items) return warehousesResponse.data.data.items;
    if (warehousesResponse?.data?.items) return warehousesResponse.data.items;
    if (warehousesResponse?.data?.warehouses) return warehousesResponse.data.warehouses;
    if (warehousesResponse?.warehouses) return warehousesResponse.warehouses;
    if (Array.isArray(warehousesResponse)) return warehousesResponse;
    return [];
  }, [warehousesResponse]);

  // Mutations
  const [createWarehouse] = useCreateWarehouseMutation();
  const [updateWarehouse] = useUpdateWarehouseMutation();
  const [deleteWarehouse] = useDeleteWarehouseMutation();

  const handleSave = async (formData) => {
    try {
      if (selectedWarehouse) {
        await updateWarehouse({ id: selectedWarehouse._id, ...formData }).unwrap();
        toast.success('Warehouse updated successfully');
      } else {
        await createWarehouse(formData).unwrap();
        toast.success('Warehouse created successfully');
      }
      setIsModalOpen(false);
      setSelectedWarehouse(null);
      refetchWarehouses();
    } catch (mutationError) {
      const message =
        mutationError?.data?.message || mutationError?.message || 'Unable to save warehouse';
      toast.error(message);
    }
  };

  const handleAdd = () => {
    setSelectedWarehouse(null);
    setIsModalOpen(true);
  };

  const handleEdit = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setIsModalOpen(true);
  };

  const handleDelete = async (warehouse) => {
    const confirmed = await confirmDelete(
      `Are you sure you want to delete "${warehouse.name}" warehouse? This action cannot be undone.`
    );
    if (confirmed) {
      try {
        await deleteWarehouse(warehouse._id).unwrap();
        toast.success('Warehouse deleted successfully');
        refetchWarehouses();
      } catch (mutationError) {
        const message =
          mutationError?.data?.message || mutationError?.message || 'Unable to delete warehouse';
        toast.error(message);
      }
    }
  };

  const isSubmitting = false; // Can track mutation loading states if needed

  if (isLoading) {
    return <LoadingPage message="Loading warehouses..." />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <LoadingCard title="Failed to load warehouses">
          <p className="text-sm text-red-500">
            {error.message || 'Something went wrong while fetching warehouses.'}
          </p>
        </LoadingCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Warehouses</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Manage warehouse locations, contacts, capacity, and availability.
          </p>
        </div>
        <button onClick={handleAdd} className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          <span>Add Warehouse</span>
        </button>
      </div>

      <div className="rounded-lg bg-white p-4 shadow">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or code..."
                className="input pl-9"
              />
            </div>
          </div>
          <div className="flex items-end">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="checkbox"
              />
              <span className="text-sm font-medium text-gray-700">Show active only</span>
            </label>
          </div>
          {isFetching && (
            <div className="flex items-end justify-end text-xs text-gray-500">
              <LoadingSpinner className="mr-2 h-4 w-4" />
              Refreshing...
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="hidden md:block">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Warehouse
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Location
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Contact
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {warehouses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                    No warehouses found. Click &ldquo;Add Warehouse&rdquo; to create the first one.
                  </td>
                </tr>
              ) : (
                warehouses.map((warehouse) => {
                  const address = warehouse.address || {};
                  const contact = warehouse.contact || {};
                  const locationSummary = [address.city, address.state, address.country]
                    .filter(Boolean)
                    .join(', ');

                  return (
                    <tr key={warehouse._id}>
                      <td className="px-4 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                            <Warehouse className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-semibold text-gray-900">{warehouse.name}</p>
                              {warehouse.isPrimary && (
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Primary
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">
                              Code: {warehouse.code}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {locationSummary || address.line1 || '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {contact.name ? (
                          <div className="space-y-1">
                            <p className="font-medium text-gray-900">{contact.name}</p>
                            <p className="text-xs text-gray-500">{contact.phone || 'No phone'}</p>
                            <p className="text-xs text-gray-500">{contact.email || 'No email'}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">No contact</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            warehouse.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {warehouse.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(warehouse)}
                            className="rounded-md p-2 text-blue-600 transition hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(warehouse)}
                            className="rounded-md p-2 text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 p-4 md:hidden">
          {warehouses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              No warehouses found. Tap &ldquo;Add Warehouse&rdquo; to create one.
            </div>
          ) : (
            warehouses.map((warehouse) => {
              const address = warehouse.address || {};
              const contact = warehouse.contact || {};
              const locationSummary = [address.city, address.state, address.country]
                .filter(Boolean)
                .join(', ');

              return (
                <div key={warehouse._id} className="rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold text-gray-900">{warehouse.name}</h3>
                        {warehouse.isPrimary && (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-xs uppercase text-gray-500">Code: {warehouse.code}</p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        warehouse.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {warehouse.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Location:</span>{' '}
                      {locationSummary || address.line1 || '—'}
                    </p>
                    <p>
                      <span className="font-medium">Contact:</span>{' '}
                      {contact.name || 'Not assigned'}
                    </p>
                    {contact.phone && <p>Phone: {contact.phone}</p>}
                    {contact.email && <p>Email: {contact.email}</p>}
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => handleEdit(warehouse)}
                      className="btn btn-secondary btn-md flex-1"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(warehouse)}
                      className="btn btn-danger btn-md flex-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isModalOpen && (
        <WarehouseFormModal
          warehouse={selectedWarehouse}
          onSave={handleSave}
          onCancel={() => {
            setIsModalOpen(false);
            setSelectedWarehouse(null);
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {deleteDialog}
    </div>
  );
};

export default Warehouses;

