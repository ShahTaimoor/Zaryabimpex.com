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
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const LIMIT_OPTIONS = [50, 500, 1000, 5000];
const DEFAULT_LIMIT = 50;

const Products = () => {
  const dispatch = useAppDispatch();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_LIMIT);
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
    search: searchTerm || undefined,
    page: currentPage,
    limit: itemsPerPage,
    ...filters
  };

  const { data, isLoading, error, refetch } = useGetProductsQuery(queryParams, {
    refetchOnMountOrArgChange: true,
  });

  const { data: categoriesDataRaw } = useGetCategoriesQuery({ limit: 999999 }, {
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

  const products = allProducts;

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
    setCurrentPage(1);
  };

  const handleLimitChange = (e) => {
    const val = Number(e.target.value);
    setItemsPerPage(val);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleClearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setCurrentPage(1);
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
        <Button
          onClick={() => refetch()}
          variant="default"
          size="default"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
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
          <Button
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
            variant="outline"
            size="default"
            className="flex items-center justify-center gap-2"
          >
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Category</span>
            <span className="sm:hidden">Category</span>
          </Button>
          <Button
            onClick={refreshCategories}
            variant="outline"
            size="default"
            className="flex items-center justify-center gap-2"
            title="Refresh categories list"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
            <span className="sm:hidden">Refresh</span>
          </Button>
          <Button
            onClick={() => setShowBarcodeScanner(true)}
            variant="outline"
            size="default"
            className="flex items-center justify-center gap-2"
            title="Scan barcode to search product"
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Scan</span>
            <span className="sm:hidden">Scan</span>
          </Button>
          <Button
            onClick={() => setShowLabelPrinter(true)}
            variant="outline"
            size="default"
            className="flex items-center justify-center gap-2"
            title="Print barcode labels"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print</span>
            <span className="sm:hidden">Print</span>
          </Button>
          <Button
            onClick={() => productOps.setIsModalOpen(true)}
            variant="default"
            size="default"
            className="flex items-center justify-center gap-2 col-span-2 sm:col-span-1"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      <div className="w-full">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full text-sm sm:text-base"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <label htmlFor="limit-select" className="text-sm text-gray-600 whitespace-nowrap">Show:</label>
            <select
              id="limit-select"
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
      </div>

      <ProductImportExport 
        onImportComplete={() => {
          dispatch(api.util.invalidateTags([{ type: 'Products', id: 'LIST' }]));
        }}
        filters={{ ...queryParams, limit: 999999, page: 1 }}
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
            {' products'}
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
