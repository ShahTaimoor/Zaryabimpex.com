import { useState } from 'react';
import { useAppDispatch } from '../store/hooks';
import { api } from '../store/api';
import {
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useBulkUpdateProductsMutation,
  useBulkDeleteProductsMutation,
  useLinkInvestorsMutation,
} from '../store/services/productsApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { toast } from 'sonner';

export const useProductOperations = (products, refetch) => {
  const dispatch = useAppDispatch();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductForInvestors, setSelectedProductForInvestors] = useState(null);
  const [isInvestorsModalOpen, setIsInvestorsModalOpen] = useState(false);

  const [createProduct, { isLoading: creating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();
  const [linkInvestors] = useLinkInvestorsMutation();
  const [deleteProduct, { isLoading: deleting }] = useDeleteProductMutation();
  const [bulkUpdateProducts] = useBulkUpdateProductsMutation();
  const [bulkDeleteProducts] = useBulkDeleteProductsMutation();

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleEditExisting = (existingProduct) => {
    setSelectedProduct(existingProduct);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleSave = (data) => {
    let expiryDate = null;
    if (data.expiryDate && data.expiryDate.trim() !== '') {
      const date = new Date(data.expiryDate);
      if (!isNaN(date.getTime())) {
        expiryDate = date.toISOString();
      }
    }
    
    const processedData = {
      ...data,
      status: data.status || 'active',
      expiryDate: expiryDate,
      pricing: {
        cost: parseFloat(data.pricing.cost) || 0,
        retail: parseFloat(data.pricing.retail) || 0,
        wholesale: parseFloat(data.pricing.wholesale) || 0
      },
      inventory: {
        currentStock: parseInt(data.inventory.currentStock) || 0,
        reorderPoint: parseInt(data.inventory.reorderPoint) || 10
      },
      countryOfOrigin: data.countryOfOrigin?.trim() || null,
      netWeightKg: data.netWeightKg === '' || data.netWeightKg === null || data.netWeightKg === undefined
        ? null
        : parseFloat(data.netWeightKg),
      grossWeightKg: data.grossWeightKg === '' || data.grossWeightKg === null || data.grossWeightKg === undefined
        ? null
        : parseFloat(data.grossWeightKg),
      importRefNo: data.importRefNo?.trim() || null,
      gdNumber: data.gdNumber?.trim() || null,
      invoiceRef: data.invoiceRef?.trim() || null
    };
    
    if (!selectedProduct) {
      const normalizedInputName = data.name?.trim().toLowerCase().replace(/\s+/g, ' ');
      const existingProduct = products?.find(p => {
        const normalizedExistingName = p.name?.trim().toLowerCase().replace(/\s+/g, ' ');
        return normalizedExistingName === normalizedInputName;
      });
      
      if (existingProduct) {
        showErrorToast(`A product named "${data.name}" already exists. Please choose a different name.`);
        return;
      }
    }
    
    if (selectedProduct) {
      updateProduct({ id: selectedProduct._id, ...processedData })
        .unwrap()
        .then(() => {
          showSuccessToast('Product updated successfully');
          refetch();
        })
        .catch((error) => {
          if (error?.data?.code === 'DUPLICATE_PRODUCT_NAME' ||
              error?.data?.message?.includes('already exists')) {
            showErrorToast('A product with this name already exists. Please choose a different name.');
          } else {
            handleApiError(error, 'Product Update');
          }
        });
    } else {
      createProduct(processedData)
        .unwrap()
        .then(() => {
          showSuccessToast('Product created successfully');
          refetch();
        })
        .catch((error) => {
          if (error?.data?.code === 'DUPLICATE_PRODUCT_NAME' ||
              error?.data?.message?.includes('already exists')) {
            showErrorToast('A product with this name already exists. Please choose a different name or edit the existing product.');
          } else {
            handleApiError(error, 'Product Creation');
          }
        });
    }
  };

  const handleDelete = (product, confirmDelete) => {
    confirmDelete(product.name, 'Product', async () => {
      try {
        await deleteProduct(product._id).unwrap();
        showSuccessToast('Product deleted successfully');
        refetch();
      } catch (error) {
        handleApiError(error, 'Product Deletion');
      }
    });
  };

  const handleBulkUpdate = async (updates, bulkOps) => {
    const selectedItems = bulkOps.getSelectedItems();
    if (selectedItems.length === 0) return;

    const productIds = selectedItems.map(item => item._id);
    await bulkOps.executeBulkOperation('update', updates);
    
    try {
      await bulkUpdateProducts({ productIds, updates }).unwrap();
      showSuccessToast(`Successfully updated ${selectedItems.length} products`);
      refetch();
    } catch (error) {
      handleApiError(error, 'Bulk Update');
    }
  };

  const handleBulkDelete = async (bulkOps) => {
    const selectedItems = bulkOps.getSelectedItems();
    if (selectedItems.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedItems.length} products? This action cannot be undone.`)) {
      return;
    }

    const productIds = selectedItems.map(item => item._id);
    try {
      await bulkDeleteProducts({ productIds }).unwrap();
      showSuccessToast(`Successfully deleted ${selectedItems.length} products`);
      bulkOps.deselectAll();
      refetch();
    } catch (error) {
      handleApiError(error, 'Bulk Delete');
    }
  };

  const handleBulkExport = (bulkOps) => {
    const selectedItems = bulkOps.getSelectedItems();
    if (selectedItems.length === 0) return;

    const headers = ['Name', 'Description', 'SKU', 'HS Code', 'Stock', 'Cost', 'Retail', 'Wholesale', 'Category', 'Status'];
    const rows = selectedItems.map(item => [
      item.name || '',
      item.description || '',
      item.sku || '',
      item.hsCode || '',
      item.inventory?.currentStock || 0,
      item.pricing?.cost || 0,
      item.pricing?.retail || 0,
      item.pricing?.wholesale || 0,
      item.category?.name || '',
      item.status || ''
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showSuccessToast(`Exported ${selectedItems.length} products`);
  };

  const handleLinkInvestors = async (productId, investors) => {
    if (!productId) {
      toast.error('Missing product id. Please close and reopen the dialog.');
      return { success: false };
    }
    try {
      await linkInvestors({ productId, investors }).unwrap();
      toast.success('Investors linked successfully!');
      dispatch(api.util.invalidateTags([{ type: 'Products', id: 'LIST' }]));
      if (typeof refetch === 'function') {
        await refetch();
      }
      setIsInvestorsModalOpen(false);
      setSelectedProductForInvestors(null);
      return { success: true };
    } catch (error) {
      handleApiError(error, 'Link Investors');
      return { success: false, error };
    }
  };

  const handleAdd = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  return {
    selectedProduct,
    isModalOpen,
    selectedProductForInvestors,
    isInvestorsModalOpen,
    creating,
    updating,
    deleting,
    setSelectedProduct,
    setIsModalOpen,
    setSelectedProductForInvestors,
    setIsInvestorsModalOpen,
    handleAdd,
    handleEdit,
    handleEditExisting,
    handleCloseModal,
    handleSave,
    handleDelete,
    handleBulkUpdate,
    handleBulkDelete,
    handleBulkExport,
    handleLinkInvestors,
  };
};

