import React, { useMemo, useState, useEffect } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Plus, 
  Search, 
  Filter,
  RefreshCw,
  Eye,
  Edit,
  BarChart3,
  Settings,
  Warehouse
} from 'lucide-react';
import {
  useGetInventoryQuery,
  useGetInventorySummaryQuery,
  useGetLowStockItemsQuery,
} from '../store/services/inventoryApi';
import { useGetWarehousesQuery } from '../store/services/warehousesApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner, LoadingButton, LoadingPage } from '../components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { useResponsive, ResponsiveContainer } from '../components/ResponsiveContainer';
import ResponsiveTable from '../components/ResponsiveTable';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';
import { useFormValidation } from '../hooks/useFormValidation';
import StockAdjustmentModal from '../components/StockAdjustmentModal';
import StockUpdateModal from '../components/StockUpdateModal';
import { useNavigate } from 'react-router-dom';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../utils/componentUtils';

const LIMIT_OPTIONS = [50, 500, 1000, 5000];
const DEFAULT_LIMIT = 50;

export const Inventory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_LIMIT);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { isMobile, isTablet } = useResponsive();
  const navigate = useNavigate();
  const { openTab } = useTab();

  const debouncedSearch = useDebouncedValue(searchTerm, 350);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, lowStockFilter, warehouseFilter]);

  // Fetch inventory data
  const {
    data: inventoryData,
    isLoading,
    error,
    refetch,
  } = useGetInventoryQuery(
    {
      search: debouncedSearch,
      status: statusFilter,
      lowStock: lowStockFilter,
      warehouse: warehouseFilter,
      page: currentPage,
      limit: itemsPerPage,
    },
    { refetchOnMountOrArgChange: 120 }
  );

  // Fetch inventory summary
  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
  } = useGetInventorySummaryQuery(undefined, { refetchOnMountOrArgChange: 180, pollingInterval: 30000 });

  // Fetch low stock items
  const { data: lowStockData, isLoading: lowStockLoading } = useGetLowStockItemsQuery(undefined, {
    refetchOnMountOrArgChange: 180,
    pollingInterval: 60000,
  });

  const {
    data: warehousesData,
    isLoading: warehouseListLoading,
    error: warehouseListError,
  } = useGetWarehousesQuery(
    { isActive: 'true', limit: 100 },
    { refetchOnMountOrArgChange: true, staleTime: 5 * 60 * 1000 }
  );

  // Extract warehouses array from RTK Query response
  const warehouseList = useMemo(() => {
    return warehousesData?.data?.warehouses || warehousesData?.warehouses || warehousesData?.data || warehousesData || [];
  }, [warehousesData]);

  const handleLimitChange = (e) => {
    const val = Number(e.target.value);
    setItemsPerPage(val);
    setCurrentPage(1);
  };

  const warehouseOptions = useMemo(() => {
    const options = [
      { value: '', label: 'All Warehouses' },
      ...(Array.isArray(warehouseList) ? warehouseList : []).map((warehouse) => ({
        value: warehouse.name,
        label: warehouse.code ? `${warehouse.name} (${warehouse.code})` : warehouse.name,
      })),
    ];

    if (
      warehouseFilter &&
      !options.some((option) => option.value.toLowerCase() === warehouseFilter.toLowerCase())
    ) {
      options.push({ value: warehouseFilter, label: warehouseFilter });
    }

    return options;
  }, [warehouseList, warehouseFilter]);

  const handleOpenWarehousesTab = () => {
    const componentInfo = getComponentInfo('/warehouses');
    if (componentInfo) {
      const tabId = `warehouse_${Date.now()}`;
      openTab({
        title: componentInfo.title,
        path: '/warehouses',
        component: componentInfo.component,
        icon: componentInfo.icon,
        allowMultiple: componentInfo.allowMultiple || false,
        props: { tabId },
      });
    } else {
      navigate('/warehouses');
    }
  };

  // Table columns configuration
  const columns = [
    {
      key: 'sno',
      header: 'S.NO',
      render: (value, item, index) => (currentPage - 1) * itemsPerPage + index + 1,
    },
    {
      key: 'product',
      header: 'Product',
      accessor: (item) => item.product?.name || 'N/A',
      render: (value, item) => (
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Package className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <div className="font-medium text-gray-900">{item.product?.name || 'N/A'}</div>
            <div className="text-sm text-gray-500">Category: {typeof item.product?.category === 'object' ? (item.product?.category?.name ?? 'N/A') : (item.product?.category || 'N/A')}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'currentStock',
      header: 'Current Stock',
      accessor: (item) => item.currentStock,
      render: (value, item) => {
        const isLowStock = value <= item.reorderPoint;
        const isOutOfStock = value === 0;
        
        return (
          <div className={`text-center ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-green-600'}`}>
            <div className="font-semibold">{value}</div>
            {isLowStock && (
              <div className="text-xs">Reorder: {item.reorderPoint}</div>
            )}
          </div>
        );
      },
    },
    {
      key: 'availableStock',
      header: 'Available',
      accessor: (item) => item.availableStock,
      render: (value) => (
        <div className="text-center font-medium">{value}</div>
      ),
    },
    {
      key: 'reservedStock',
      header: 'Reserved',
      accessor: (item) => item.reservedStock,
      render: (value) => (
        <div className="text-center text-gray-600">{value}</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (item) => item.status,
      render: (value, item) => {
        const statusConfig = {
          active: { color: 'green', label: 'Active' },
          inactive: { color: 'gray', label: 'Inactive' },
          out_of_stock: { color: 'red', label: 'Out of Stock' },
          discontinued: { color: 'yellow', label: 'Discontinued' },
        };
        
        const config = statusConfig[value] || { color: 'gray', label: value };
        
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800`}>
            {config.label}
          </span>
        );
      },
    },
    {
      key: 'location',
      header: 'Location',
      accessor: (item) => item.location?.warehouse || 'Main Warehouse',
      render: (value, item) => (
        <div className="text-sm">
          <div>{value}</div>
          {item.location?.aisle && (
            <div className="text-gray-500">Aisle: {item.location.aisle}</div>
          )}
        </div>
      ),
    },
    {
      key: 'lastUpdated',
      header: 'Last Updated',
      accessor: (item) => {
        const date = item.lastUpdated || item.updatedAt || item.createdAt;
        if (!date) return 'N/A';
        try {
          return new Date(date).toLocaleDateString();
        } catch (e) {
          return 'N/A';
        }
      },
      render: (value) => (
        <div className="text-sm text-gray-600">{value}</div>
      ),
    },
  ];

  // Mobile card component for responsive table
  const MobileInventoryCard = ({ item, index }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm min-w-0">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Package className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{item.product?.name || 'N/A'}</h3>
            <p className="text-sm text-gray-500">Category: {typeof item.product?.category === 'object' ? (item.product?.category?.name ?? 'N/A') : (item.product?.category || 'N/A')}</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-semibold ${item.currentStock === 0 ? 'text-red-600' : item.currentStock <= item.reorderPoint ? 'text-yellow-600' : 'text-green-600'}`}>
            {item.currentStock}
          </div>
          <div className="text-xs text-gray-500">in stock</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-xs text-gray-500">Available</div>
          <div className="font-medium">{item.availableStock}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Reserved</div>
          <div className="font-medium">{item.reservedStock}</div>
        </div>
      </div>
      
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          item.status === 'active' ? 'bg-green-100 text-green-800' :
          item.status === 'out_of_stock' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {item.status === 'active' ? 'Active' : item.status === 'out_of_stock' ? 'Out of Stock' : item.status}
        </span>
        <div className="text-xs text-gray-500">
          {item.location?.warehouse || 'Main Warehouse'}
        </div>
      </div>
      <div className="text-xs text-gray-400">
        Last Updated: {(() => {
          const date = item.lastUpdated || item.updatedAt || item.createdAt;
          if (!date) return 'N/A';
          try {
            return new Date(date).toLocaleDateString();
          } catch (e) {
            return 'N/A';
          }
        })()}
      </div>
    </div>
  );

  const handleRowClick = (item) => {
    setSelectedProduct(item);
    setShowUpdateModal(true);
  };

  const handleEdit = (item) => {
    setSelectedProduct(item);
    setShowUpdateModal(true);
  };

  const handleView = (item) => {
    setSelectedProduct(item);
    // Navigate to detailed view or show modal
  };

  if (isLoading) {
    return <LoadingPage message="Loading inventory..." />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading inventory</h3>
        <p className="mt-1 text-sm text-gray-500">{error.message}</p>
        <Button
          onClick={() => refetch()}
          variant="default"
          className="mt-4"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <ResponsiveContainer className="space-y-4 xl:space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Track and manage product stock levels</p>
        </div>
        
        <div className="flex flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto flex-shrink-0">
          {!lowStockFilter && (
            <Button
              onClick={() => setShowAdjustmentModal(true)}
              variant="default"
              size="default"
              className="flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Stock Adjustment
            </Button>
          )}
          <Button
            onClick={() => refetch()}
            variant="secondary"
            size="default"
            className="flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={handleOpenWarehousesTab}
            variant="ghost"
            size="default"
            className="flex items-center justify-center gap-2"
          >
            <Warehouse className="h-4 w-4" />
            Add Warehouse
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="h-7 bg-gray-200 rounded w-12" />
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 xl:p-5 min-w-0">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-blue-100 rounded-full">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryData?.totalProducts ?? 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 xl:p-5 min-w-0">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-green-100 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">In Stock</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(summaryData?.totalProducts ?? 0) - (summaryData?.outOfStock ?? 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 xl:p-5 min-w-0">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-yellow-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryData?.lowStock ?? 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 xl:p-5 min-w-0">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-red-100 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryData?.outOfStock ?? 0}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4 xl:p-5 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Show</label>
            <select
              value={itemsPerPage}
              onChange={handleLimitChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Warehouse</label>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              disabled={warehouseListLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white disabled:bg-gray-50"
            >
              {warehouseOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {warehouseListError && (
              <p className="mt-1 text-xs text-red-500">Unable to load warehouses.</p>
            )}
          </div>
          <div className="flex items-center sm:items-end lg:col-span-2 sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lowStockFilter}
                onChange={(e) => setLowStockFilter(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              />
              <span className="text-sm font-medium text-gray-700">Low Stock Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-w-0">
        <ResponsiveTable
          data={inventoryData?.inventory ?? inventoryData?.data?.inventory ?? inventoryData?.data?.items ?? []}
          columns={columns}
          onRowClick={handleRowClick}
          onEdit={handleEdit}
          onView={handleView}
          mobileCardComponent={MobileInventoryCard}
          searchable={false}
          emptyMessage="No inventory items found"
          useMobileCardsOnTablet
        />
      </div>

      {/* Pagination */}
      {(inventoryData?.pagination || inventoryData?.data?.pagination) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="text-xs sm:text-sm text-gray-700">
            {(() => {
              const pagination = inventoryData?.pagination || inventoryData?.data?.pagination;
              const total = pagination?.total || 0;
              const start = ((currentPage - 1) * itemsPerPage) + 1;
              const end = Math.min(currentPage * itemsPerPage, total);
              return `Showing ${start} to ${end} of ${total} results`;
            })()}
          </div>
          <div className="flex space-x-2 w-full sm:w-auto">
            {(() => {
              const pagination = inventoryData?.pagination || inventoryData?.data?.pagination;
              return (
                <>
                  <Button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={!pagination?.hasPrev}
                    variant="secondary"
                    size="default"
                    className="flex-1 sm:flex-none"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={!pagination?.hasNext}
                    variant="secondary"
                    size="default"
                    className="flex-1 sm:flex-none"
                  >
                    Next
                  </Button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modals */}
      <StockAdjustmentModal
        isOpen={showAdjustmentModal}
        onClose={() => setShowAdjustmentModal(false)}
        onSuccess={() => {
          // RTK Query mutations already invalidate tags automatically
          // But we also refetch to ensure immediate update
          refetch();
          setShowAdjustmentModal(false);
        }}
      />

      <StockUpdateModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        product={selectedProduct}
        onSuccess={() => {
          // RTK Query mutations already invalidate tags automatically
          // But we also refetch to ensure immediate update
          refetch();
          setShowUpdateModal(false);
          setSelectedProduct(null);
        }}
      />
    </ResponsiveContainer>
  );
};