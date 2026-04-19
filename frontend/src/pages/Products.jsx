import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  AlertTriangle,
  RefreshCw,
  Tag,
  Camera,
  Printer,
  Download,
} from 'lucide-react';
import {
  useGetProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useBulkUpdateProductsMutation,
  useBulkDeleteProductsMutation,
  useLinkInvestorsMutation,
  useBulkCreateProductsMutation,
} from '../store/services/productsApi';
import { useGetCategoryTreeQuery } from '../store/services/categoriesApi';
import { flattenCategoryApiTree } from '../utils/categoryTree';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { toast } from 'sonner';
import { LoadingPage } from '../components/LoadingSpinner';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';

import ProductFilters from '../components/ProductFilters';
import { useTab } from '../contexts/TabContext';
import { useBulkOperations } from '../hooks/useBulkOperations';
import BulkOperationsBar from '../components/BulkOperationsBar';
import BulkUpdateModal from '../components/BulkUpdateModal';
import {
  exportToExcel,
  importExcelFile,
  exportTemplate
} from '../utils/excelExport';
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
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ExcelExportButton from '../components/ExcelExportButton';
import ExcelImportButton from '../components/ExcelImportButton';
import PdfExportButton from '../components/PdfExportButton';
import { useCursorPagination } from '../hooks/useCursorPagination';

const LIMIT_OPTIONS = [50, 500, 1000, 5000];
const DEFAULT_LIMIT = 50;

export const Products = () => {
  const dispatch = useAppDispatch();
  const [searchTerm, setSearchTerm] = useState('');
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

  const debouncedSearch = useDebouncedValue(searchTerm, 350);

  const {
    currentPage,
    currentCursor,
    updateFromPagination,
    getUiPagination,
    goToPage,
  } = useCursorPagination([debouncedSearch, JSON.stringify(filters), itemsPerPage]);

  const queryParams = {
    search: debouncedSearch || undefined,
    page: currentPage,
    cursor: currentCursor,
    limit: itemsPerPage,
    ...filters
  };

  const { data, isLoading, error, refetch } = useGetProductsQuery(queryParams, {
    refetchOnMountOrArgChange: 120,
  });

  const { data: categoryTreeRaw } = useGetCategoryTreeQuery(undefined, {
    refetchOnMountOrArgChange: 300,
  });

  const categoriesData = useMemo(() => {
    const roots = Array.isArray(categoryTreeRaw) ? categoryTreeRaw : [];
    return flattenCategoryApiTree(roots);
  }, [categoryTreeRaw]);

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
    return getUiPagination(raw, itemsPerPage);
  }, [data, getUiPagination, itemsPerPage]);

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
  };

  const handleLimitChange = (e) => {
    const val = Number(e.target.value);
    setItemsPerPage(val);
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  useEffect(() => {
    const raw = data?.pagination || data?.data?.pagination || {};
    updateFromPagination(raw);
  }, [data, updateFromPagination]);

  const handleBulkUpdate = async (updates) => {
    await productOps.handleBulkUpdate(updates, bulkOps);
    setShowBulkUpdateModal(false);
    setBulkUpdateType(null);
  };

  const [bulkCreateProducts] = useBulkCreateProductsMutation();
  const [autoCreateImportCategories, setAutoCreateImportCategories] = useState(true);

  const { companyInfo: companySettings } = useCompanyInfo();
  const showCostPrice = companySettings.orderSettings?.showCostPrice !== false;

  const getExportData = () => {
    const columns = [
      { header: 'S.No', key: 'sno', width: 8, type: 'number' },
      { header: 'Image', key: 'imageUrl', width: 12, type: 'image' },
      { header: 'Product Name', key: 'displayName', width: 40 },
      { header: 'Category', key: 'categoryName', width: 25 },
      ...(showCostPrice ? [{ header: 'Cost Price', key: 'costPrice', width: 15, type: 'currency' }] : []),
      { header: 'Retail Price', key: 'retailPrice', width: 15, type: 'currency' },
      { header: 'Wholesale Price', key: 'wholesalePrice', width: 15, type: 'currency' },
      { header: 'Stock', key: 'stock', width: 12, type: 'number' }
    ];

    return {
      title: 'Product Catalog',
      filename: `Products_${new Date().toLocaleDateString()}.xlsx`,
      columns: columns,
      data: allProducts.map((p, i) => ({
        ...p,
        sno: i + 1,
        displayName: p.name || 'N/A',
        imageUrl: p.imageUrl || null,
        categoryName: p.categoryName || p.category?.name || (typeof p.category === 'string' ? p.category : '-'),
        costPrice: p.pricing?.cost || 0,
        retailPrice: p.pricing?.retail || 0,
        wholesalePrice: p.pricing?.wholesale || 0,
        stock: p.inventory?.currentStock || p.stockQuantity || 0
      }))
    };
  };

  const handleDownloadTemplate = () => {
    const columns = [
      { header: 'Product Name', key: 'name', width: 35 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      ...(showCostPrice ? [{ header: 'Cost Price', key: 'costPrice', width: 15, type: 'currency' }] : []),
      { header: 'Retail Price', key: 'retailPrice', width: 15, type: 'currency' },
      { header: 'Wholesale Price', key: 'wholesalePrice', width: 20, type: 'currency' },
      { header: 'Opening Stock', key: 'stock', width: 15, type: 'number' }
    ];

    exportTemplate({
      title: 'Product Import Template',
      filename: 'Product_Template.xlsx',
      columns: columns
    });
  };

  const handleImportData = async (data) => {
    if (!data || data.length === 0) return;

    const toastId = toast.loading(`Saving ${data.length} products to database...`);
    try {
      const response = await bulkCreateProducts({
        products: data,
        autoCreateCategories: autoCreateImportCategories
      }).unwrap();
      if (response.created > 0) {
        toast.success(`Successfully imported ${response.created} products!`, { id: toastId });
        if (response.failed > 0) {
          toast.warning(`${response.failed} products failed to import. Check console for details.`);
          console.warn('Import failures:', response.errors);
        }
      } else {
        toast.error('Failed to import products. Check file format.', { id: toastId });
      }
    } catch (error) {
      console.error('Bulk Import Error:', error);
      toast.error(error.data?.message || 'Error occurred while saving products.', { id: toastId });
    }
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
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage your product catalog</p>
        </div>
        <div className="flex-shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
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
            className="flex items-center justify-center gap-2 border-gray-200 bg-white text-gray-700 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 transition-all shadow-sm"
          >
            <Tag className="h-4 w-4 text-indigo-600" />
            <span className="hidden sm:inline font-semibold">Category</span>
            <span className="sm:hidden font-semibold">Category</span>
          </Button>
          <Button
            onClick={refreshCategories}
            variant="outline"
            size="default"
            className="flex items-center justify-center gap-2 border-gray-200 bg-white text-gray-700 hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700 transition-all shadow-sm"
            title="Refresh categories list"
          >
            <RefreshCw className="h-4 w-4 text-teal-600" />
            <span className="hidden sm:inline font-semibold">Refresh</span>
            <span className="sm:hidden font-semibold">Refresh</span>
          </Button>
          <Button
            onClick={() => setShowBarcodeScanner(true)}
            variant="outline"
            size="default"
            className="flex items-center justify-center gap-2 border-gray-200 bg-white text-gray-700 hover:border-amber-500 hover:bg-amber-50 hover:text-amber-700 transition-all shadow-sm"
            title="Scan barcode to search product"
          >
            <Camera className="h-4 w-4 text-amber-600" />
            <span className="hidden sm:inline font-semibold">Scan</span>
            <span className="sm:hidden font-semibold">Scan</span>
          </Button>
          <Button
            onClick={() => setShowLabelPrinter(true)}
            variant="outline"
            size="default"
            className="flex items-center justify-center gap-2 border-gray-200 bg-white text-gray-700 hover:border-purple-500 hover:bg-purple-50 hover:text-purple-700 transition-all shadow-sm"
            title="Print barcode labels"
          >
            <Printer className="h-4 w-4 text-purple-600" />
            <span className="hidden sm:inline font-semibold">Print Barcode</span>
            <span className="sm:hidden font-semibold">Print Barcode</span>
          </Button>
          <Button
            onClick={() => productOps.handleAdd()}
            variant="default"
            size="default"
            className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white transition-all shadow-md active:scale-95 px-6 font-bold tracking-tight"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline uppercase">ADD PRODUCT</span>
            <span className="sm:hidden uppercase">ADD</span>
          </Button>
          <ExcelExportButton
            getData={getExportData}
            label="Export"
          />
          <PdfExportButton
            getData={getExportData}
            label="PDF"
          />
          <ExcelImportButton
            onDataImported={handleImportData}
            label="Import"
          />
          <label className="inline-flex items-center gap-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
            <input
              type="checkbox"
              checked={autoCreateImportCategories}
              onChange={(e) => setAutoCreateImportCategories(e.target.checked)}
              className="h-4 w-4"
            />
            Auto-create category
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

      <div className="w-full">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search name, SKU, barcode, HS, import refs..."
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
        availableActions={['update', 'status', 'category', 'price', 'stock']}
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
        showDeleteButton={false}
        onDelete={(product) => productOps.handleDelete(product, confirmDelete)}
        onManageInvestors={(product) => {
          productOps.setSelectedProductForInvestors(product);
          productOps.setIsInvestorsModalOpen(true);
        }}
        onGenerateBarcode={(product) => {
          productOps.setSelectedProduct(product);
          setShowBarcodeGenerator(true);
        }}
        showCostPrice={showCostPrice}
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
              onClick={() => goToPage(currentPage - 1, pagination.hasNext)}
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
              onClick={() => goToPage(currentPage + 1, pagination.hasNext)}
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
