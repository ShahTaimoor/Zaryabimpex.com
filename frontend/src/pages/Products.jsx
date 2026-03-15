import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  AlertTriangle,
  RefreshCw,
  Tag,
  Camera,
  Printer,
} from 'lucide-react';
import {
  useGetProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useBulkUpdateProductsMutation,
  useBulkDeleteProductsMutation,
  useLinkInvestorsMutation,
} from '../store/services/productsApi';
import { useGetCategoriesQuery } from '../store/services/categoriesApi';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import toast from 'react-hot-toast';
import { LoadingPage } from '../components/LoadingSpinner';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';
import ProductImportExport from '../components/ProductImportExport';
import ProductFilters from '../components/ProductFilters';
import { useTab } from '../contexts/TabContext';
import { useBulkOperations } from '../hooks/useBulkOperations';
import BulkOperationsBar from '../components/BulkOperationsBar';
import BulkUpdateModal from '../components/BulkUpdateModal';
import { getComponentInfo } from '../utils/componentUtils';
import BarcodeScanner from '../components/BarcodeScanner';
import BarcodeGenerator from '../components/BarcodeGenerator';
import BarcodeLabelPrinter from '../components/BarcodeLabelPrinter';
import NotesPanel from '../components/NotesPanel';
import { ProductModal } from '../components/ProductModal';
import { ProductInvestorsModal } from '../components/ProductInvestorsModal';
import { ProductList } from '../components/ProductList';
import { useAppDispatch } from '../store/hooks';
import { api } from '../store/api';
import { useProductOperations } from '../hooks/useProductOperations';

const Products = () => {
  const dispatch = useAppDispatch();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({});
  const [bulkUpdateType, setBulkUpdateType] = useState(null);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showBarcodeGenerator, setShowBarcodeGenerator] = useState(false);
  const [showLabelPrinter, setShowLabelPrinter] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notesEntity, setNotesEntity] = useState(null);
  const { openTab } = useTab();

  const queryParams = { 
    search: searchTerm,
    limit: 999999,
    ...filters
  };

  const { data, isLoading, error, refetch } = useGetProductsQuery(queryParams, {
    refetchOnMountOrArgChange: true,
  });

  const { data: categoriesDataRaw } = useGetCategoriesQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const categoriesData = useMemo(() => {
    if (!categoriesDataRaw) return [];
    if (Array.isArray(categoriesDataRaw)) return categoriesDataRaw;
    if (categoriesDataRaw?.data?.categories) return categoriesDataRaw.data.categories;
    if (categoriesDataRaw?.categories) return categoriesDataRaw.categories;
    if (categoriesDataRaw?.data?.data?.categories) return categoriesDataRaw.data.data.categories;
    return [];
  }, [categoriesDataRaw]);

  const allProducts = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data?.data?.products) return data.data.products;
    if (data?.products) return data.products;
    if (data?.data?.data?.products) return data.data.data.products;
    if (data?.items) return data.items;
    return [];
  }, [data]);
  
  const products = useFuzzySearch(
    allProducts,
    searchTerm,
    ['name', 'description', 'brand', 'category.name'],
    {
      threshold: 0.4,
      minScore: 0.3,
      limit: null
    }
  );

  const bulkOps = useBulkOperations(products, {
    idField: '_id',
    enableUndo: true
  });

  const { confirmation, confirmDelete, handleConfirm, handleCancel } = useDeleteConfirmation();

  const productOps = useProductOperations(allProducts, refetch);

  const refreshCategories = () => {
    dispatch(api.util.invalidateTags([{ type: 'Categories', id: 'LIST' }]));
    toast.success('Categories refreshed');
  };


  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  const handleBulkUpdate = async (updates) => {
    await productOps.handleBulkUpdate(updates, bulkOps);
    setShowBulkUpdateModal(false);
    setBulkUpdateType(null);
  };

  if (isLoading && !data) {
    return <LoadingPage message="Loading products..." />;
  }

  if (error && !data) {
    let errorMessage = 'Unable to load products. Please try again.';
    if (error?.response?.data?.errors) {
      const validationErrors = error.response.data.errors;
      const errorDetails = validationErrors.map(err => {
        const field = err.param || err.field || '';
        const msg = err.msg || err.message || 'Invalid value';
        return field ? `${field}: ${msg}` : msg;
      });
      errorMessage = errorDetails.length > 0 
        ? errorDetails.join(', ')
        : (error.response.data.message || 'Invalid request parameters');
    } else if (error?.response?.data?.details) {
      errorMessage = Array.isArray(error.response.data.details)
        ? error.response.data.details.join(', ')
        : error.response.data.details;
    } else if (error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Failed to Load Products
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {errorMessage}
        </p>
        <button
          onClick={() => refetch()}
          className="btn btn-primary btn-md"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage your product catalog</p>
        </div>
        <div className="flex-shrink-0 grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              const componentInfo = getComponentInfo('/categories');
              if (componentInfo) {
                openTab({
                  title: 'Add Product Category',
                  path: '/categories?action=add',
                  component: componentInfo.component,
                  icon: componentInfo.icon,
                  allowMultiple: true,
                  props: { action: 'add' }
                });
              }
            }}
            className="btn btn-outline btn-md flex items-center justify-center gap-2"
          >
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Category</span>
            <span className="sm:hidden">Category</span>
          </button>
          <button
            onClick={refreshCategories}
            className="btn btn-outline btn-md flex items-center justify-center gap-2"
            title="Refresh categories list"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
            <span className="sm:hidden">Refresh</span>
          </button>
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="btn btn-outline btn-md flex items-center justify-center gap-2"
            title="Scan barcode to search product"
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Scan</span>
            <span className="sm:hidden">Scan</span>
          </button>
          <button
            onClick={() => setShowLabelPrinter(true)}
            className="btn btn-outline btn-md flex items-center justify-center gap-2"
            title="Print barcode labels"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print</span>
            <span className="sm:hidden">Print</span>
          </button>
          <button
            onClick={() => productOps.setIsModalOpen(true)}
            className="btn btn-primary btn-md flex items-center justify-center gap-2 col-span-2 sm:col-span-1"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div className="w-full">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full text-sm sm:text-base"
            />
          </div>
        </div>
      </div>

      <ProductImportExport 
        onImportComplete={() => {
          dispatch(api.util.invalidateTags([{ type: 'Products', id: 'LIST' }]));
        }}
        filters={queryParams}
      />

      <ProductFilters 
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        categories={categoriesData || []}
      />

      <BulkOperationsBar
        selectedCount={bulkOps.selectedCount}
        isOperationInProgress={bulkOps.isOperationInProgress}
        operationProgress={bulkOps.operationProgress}
        canUndo={bulkOps.canUndo}
        onBulkUpdate={() => {
          setBulkUpdateType('update');
          setShowBulkUpdateModal(true);
        }}
        onBulkDelete={() => productOps.handleBulkDelete(bulkOps)}
        onBulkExport={() => productOps.handleBulkExport(bulkOps)}
        onBulkStatusChange={() => {
          setBulkUpdateType('status');
          setShowBulkUpdateModal(true);
        }}
        onBulkCategoryChange={() => {
          setBulkUpdateType('category');
          setShowBulkUpdateModal(true);
        }}
        onBulkPriceUpdate={() => {
          setBulkUpdateType('price');
          setShowBulkUpdateModal(true);
        }}
        onBulkStockAdjust={() => {
          setBulkUpdateType('stock');
          setShowBulkUpdateModal(true);
        }}
        onUndo={bulkOps.undoLastOperation}
        onClearSelection={bulkOps.deselectAll}
        availableActions={['update', 'delete', 'export', 'status', 'category', 'price', 'stock']}
      />

      <BulkUpdateModal
        isOpen={showBulkUpdateModal}
        onClose={() => {
          setShowBulkUpdateModal(false);
          setBulkUpdateType(null);
        }}
        selectedCount={bulkOps.selectedCount}
        updateType={bulkUpdateType}
        onConfirm={handleBulkUpdate}
        categories={categoriesData || []}
        statusOptions={[
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'discontinued', label: 'Discontinued' }
        ]}
        isLoading={bulkOps.isOperationInProgress}
      />

      <ProductList
        products={products}
        searchTerm={searchTerm}
        bulkOps={bulkOps}
        onEdit={productOps.handleEdit}
        onDelete={(product) => productOps.handleDelete(product, confirmDelete)}
        onManageInvestors={(product) => {
          productOps.setSelectedProductForInvestors(product);
          productOps.setIsInvestorsModalOpen(true);
        }}
        onGenerateBarcode={(product) => {
          productOps.setSelectedProduct(product);
          setShowBarcodeGenerator(true);
        }}
      />

      <ProductModal
        product={productOps.selectedProduct}
        isOpen={productOps.isModalOpen}
        onClose={productOps.handleCloseModal}
        onSave={productOps.handleSave}
        isSubmitting={productOps.creating || productOps.updating}
        allProducts={products || []}
        onEditExisting={productOps.handleEditExisting}
        categories={categoriesData || []}
      />
      
      <DeleteConfirmationDialog
        isOpen={confirmation.isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        itemName={confirmation.message?.match(/"([^"]*)"/)?.[1] || ''}
        itemType="Product"
        isLoading={productOps.deleting}
      />

      {productOps.selectedProductForInvestors && (
        <ProductInvestorsModal
          product={productOps.selectedProductForInvestors}
          isOpen={productOps.isInvestorsModalOpen}
          onClose={() => {
            productOps.setIsInvestorsModalOpen(false);
            productOps.setSelectedProductForInvestors(null);
          }}
          onSave={productOps.handleLinkInvestors}
        />
      )}

      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={(barcodeValue) => {
          setSearchTerm(barcodeValue);
          setFilters({ barcode: barcodeValue });
          setShowBarcodeScanner(false);
          toast.success(`Searching for barcode: ${barcodeValue}`);
        }}
        scanMode="both"
      />

      {showBarcodeGenerator && productOps.selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <BarcodeGenerator
              product={productOps.selectedProduct}
              barcodeValue={productOps.selectedProduct.barcode}
              onClose={() => {
                setShowBarcodeGenerator(false);
                productOps.setSelectedProduct(null);
              }}
            />
          </div>
        </div>
      )}

      {showLabelPrinter && (
        <BarcodeLabelPrinter
          products={products || []}
          onClose={() => setShowLabelPrinter(false)}
        />
      )}

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

export default Products;
