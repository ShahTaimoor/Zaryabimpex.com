import React, { useMemo, useState } from 'react';
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
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage } from '../components/LoadingSpinner';
import { useResponsive, ResponsiveContainer, ResponsiveGrid } from '../components/ResponsiveContainer';
import ResponsiveTable from '../components/ResponsiveTable';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';
import { useFormValidation } from '../hooks/useFormValidation';
import StockAdjustmentModal from '../components/StockAdjustmentModal';
import StockUpdateModal from '../components/StockUpdateModal';
import { useNavigate } from 'react-router-dom';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../utils/componentUtils';

export const Inventory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { isMobile, isTablet } = useResponsive();
  const navigate = useNavigate();
  const { openTab } = useTab();

  // Fetch inventory data
  const {
    data: inventoryData,
    isLoading,
    error,
    refetch,
  } = useGetInventoryQuery(
    {
      search: searchTerm,
      status: statusFilter,
      lowStock: lowStockFilter,
      warehouse: warehouseFilter,
      page: currentPage,
      limit: itemsPerPage,
    },
    { refetchOnMountOrArgChange: true }
  );

  // Fetch inventory summary
  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
  } = useGetInventorySummaryQuery(undefined, { refetchOnMountOrArgChange: true, pollingInterval: 30000 });

  // Fetch low stock items
  const { data: lowStockData, isLoading: lowStockLoading } = useGetLowStockItemsQuery(undefined, {
    refetchOnMountOrArgChange: true,
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
            <div className="text-sm text-gray-500">Category: {item.product?.category || 'N/A'}</div>
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
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Package className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{item.product?.name || 'N/A'}</h3>
            <p className="text-sm text-gray-500">Category: {item.product?.category || 'N/A'}</p>
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
        <button
          onClick={() => refetch()}
          className="mt-4 btn btn-primary"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <ResponsiveContainer className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Track and manage product stock levels</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowAdjustmentModal(true)}
            className="btn btn-primary btn-md flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Stock Adjustment
          </button>
          <button
            onClick={() => refetch()}
            className="btn btn-secondary btn-md flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleOpenWarehousesTab}
            className="btn btn-light btn-md flex items-center justify-center gap-2"
          >
            <Warehouse className="h-4 w-4" />
            Add Warehouse
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <ResponsiveGrid cols={{ default: 2, md: 4 }} gap={4}>
        <LoadingCard isLoading={summaryLoading} className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-2xl font-semibold text-gray-900">
                {summaryData?.totalProducts || 0}
              </p>
            </div>
          </div>
        </LoadingCard>
        
        <LoadingCard isLoading={summaryLoading} className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Stock</p>
              <p className="text-2xl font-semibold text-gray-900">
                {(summaryData?.totalProducts || 0) - (summaryData?.outOfStock || 0)}
              </p>
            </div>
          </div>
        </LoadingCard>
        
        <LoadingCard isLoading={summaryLoading} className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
              <p className="text-2xl font-semibold text-gray-900">
                {summaryData?.lowStock || 0}
              </p>
            </div>
          </div>
        </LoadingCard>
        
        <LoadingCard isLoading={summaryLoading} className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Out of Stock</p>
              <p className="text-2xl font-semibold text-gray-900">
                {summaryData?.outOfStock || 0}
              </p>
            </div>
          </div>
        </LoadingCard>
      </ResponsiveGrid>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 input"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </div>
          
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Warehouse</label>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="input"
              disabled={warehouseListLoading}
            >
              {warehouseOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {warehouseListError && (
              <p className="mt-1 text-xs text-red-500">
                Unable to load warehouses. Showing default filter options.
              </p>
            )}
          </div>
          
          <div className="flex items-end">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={lowStockFilter}
                onChange={(e) => setLowStockFilter(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-xs sm:text-sm font-medium text-gray-700">Low Stock Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow">
        <ResponsiveTable
          data={inventoryData?.inventory || inventoryData?.data?.inventory || []}
          columns={columns}
          onRowClick={handleRowClick}
          onEdit={handleEdit}
          onView={handleView}
          mobileCardComponent={MobileInventoryCard}
          searchable={false} // We have our own search
          emptyMessage="No inventory items found"
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
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={!pagination?.hasPrev}
                    className="btn btn-secondary btn-md flex-1 sm:flex-none"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={!pagination?.hasNext}
                    className="btn btn-secondary btn-md flex-1 sm:flex-none"
                  >
                    Next
                  </button>
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