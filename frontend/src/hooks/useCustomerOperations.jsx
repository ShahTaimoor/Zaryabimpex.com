import { useState } from 'react';
import {
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
} from '../store/services/customersApi';
import toast from 'react-hot-toast';

export const useCustomerOperations = (refetch) => {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [createCustomer, { isLoading: creating }] = useCreateCustomerMutation();
  const [updateCustomer, { isLoading: updating }] = useUpdateCustomerMutation();
  const [deleteCustomer, { isLoading: deleting }] = useDeleteCustomerMutation();

  const handleEdit = (customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCustomer(null);
  };

  const handleSave = (data) => {
    if (creating || updating) {
      toast.error('Please wait for the current request to complete');
      return;
    }

    if (selectedCustomer) {
      updateCustomer({ id: selectedCustomer._id, ...data })
        .unwrap()
        .then(() => {
          toast.success('Customer updated successfully');
          setIsModalOpen(false);
          setSelectedCustomer(null);
          refetch();
        })
        .catch((error) => {
          toast.error(error?.data?.message || 'Failed to update customer');
        });
    } else {
      createCustomer(data)
        .unwrap()
        .then(() => {
          toast.success('Customer created successfully');
          setIsModalOpen(false);
          setSelectedCustomer(null);
          refetch();
        })
        .catch((error) => {
          if (error?.status === 409 || error?.data?.code === 'DUPLICATE_ENTRY') {
            const message =
              error?.data?.message ||
              error?.data?.error?.message ||
              'Duplicate customer detected';
            toast.error(message);
          } else {
            toast.error(error?.data?.message || 'Failed to create customer');
          }
        });
    }
  };

  const handleDelete = (customer, confirmDelete) => {
    const customerName = customer.displayName || customer.businessName || customer.name || customer.email || 'Unknown Customer';
    confirmDelete(customerName, 'Customer', async () => {
      try {
        await deleteCustomer(customer._id).unwrap();
        toast.success('Customer deleted successfully');
        refetch();
      } catch (error) {
        toast.error(error?.data?.message || 'Failed to delete customer');
      }
    });
  };

  return {
    selectedCustomer,
    isModalOpen,
    creating,
    updating,
    deleting,
    setSelectedCustomer,
    setIsModalOpen,
    handleEdit,
    handleCloseModal,
    handleSave,
    handleDelete,
  };
};

