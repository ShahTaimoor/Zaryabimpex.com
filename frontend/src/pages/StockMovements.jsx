import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  RotateCcw,
  Calendar,
  MapPin,
  User,
  ArrowUpRight,
  ArrowDownLeft,
  Minus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import AsyncSelect from 'react-select/async';
import {
  useGetStockMovementsQuery,
  useGetStockMovementStatsQuery,
  useCreateStockMovementAdjustmentMutation,
  useReverseStockMovementMutation,
} from '../store/services/inventoryApi';
import { useGetProductsQuery } from '../store/services/productsApi';
import { LoadingSpinner, LoadingButton } from '../components/LoadingSpinner';
import { handleApiError } from '../utils/errorHandler';
import toast from 'react-hot-toast';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, getDateDaysAgo } from '../utils/dateUtils';

export const StockMovements = () => {
  const defaultDateTo = getCurrentDatePakistan();
  const defaultDateFrom = getDateDaysAgo(30);

  // State
  const [filters, setFilters] = useState({
    search: '',
    product: '',
    movementType: '',
    dateFrom: defaultDateFrom,
    dateTo: defaultDateTo,
    location: '',
    status: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    productId: '',
    movementType: 'adjustment_in',
    quantity: '',
    unitCost: '',
    reason: '',
    notes: '',
    location: 'main_warehouse'
  });

  // Fetch stock movements
  const {
    data: movementsData,
    isLoading,
    isFetching,
    refetch
  } = useGetStockMovementsQuery(
    {
      ...filters,
      page: currentPage,
      limit: 20
    },
    {
      onError: (error) => handleApiError(error, 'Stock Movements')
    }
  );
  const [movementTypeOptions, setMovementTypeOptions] = useState([]);

  // Fetch products for filter
  const { data: productsData, isLoading: productsLoading } = useGetProductsQuery(
    { limit: 100 },
    {
      onError: (error) => handleApiError(error, 'Products')
    }
  );
  const [productMap, setProductMap] = useState(new Map());

  useEffect(() => {
    const initialProducts = productsData?.data?.products || productsData?.products || [];
    if (Array.isArray(initialProducts) && initialProducts.length > 0) {
      setProductMap(prev => {
        const next = new Map(prev);
        initialProducts.forEach(product => {
          if (product?._id) {
            next.set(product._id, product);
          }
        });
        return next;
      });
    }
  }, [productsData]);

  const formatProductOption = useCallback((product) => {
    if (!product) return null;
    const parts = [product.name];
    if (product.sku) {
      parts.push(`SKU: ${product.sku}`);
    }
    return {
      value: product._id,
      label: parts.join(' • ')
    };
  }, []);

  const defaultProductOptions = useMemo(() => {
    return Array.from(productMap.values()).map(formatProductOption).filter(Boolean);
  }, [productMap, formatProductOption]);

  const loadProductOptions = useCallback(async (inputValue) => {
    try {
      // Use products from the query cache or return cached options
      const products = productsData?.data?.products || productsData?.products || productsData?.data?.data || [];
      const filtered = inputValue
        ? products.filter(p =>
          p.name?.toLowerCase().includes(inputValue.toLowerCase()) ||
          p.sku?.toLowerCase().includes(inputValue.toLowerCase())
        )
        : products;

      if (Array.isArray(filtered) && filtered.length > 0) {
        setProductMap(prev => {
          const next = new Map(prev);
          filtered.forEach(product => {
            if (product?._id) {
              next.set(product._id, product);
            }
          });
          return next;
        });
      }
      return filtered.slice(0, 50).map(formatProductOption).filter(Boolean);
    } catch (error) {
      handleApiError(error, 'Products');
      return [];
    }
  }, [formatProductOption, productsData]);

  const getProductOptionById = useCallback((productId) => {
    if (!productId) return null;
    const product = productMap.get(productId);
    return product ? formatProductOption(product) : null;
  }, [productMap, formatProductOption]);

  useEffect(() => {
    const options = Object.entries(movementTypes).map(([key, config]) => ({
      value: key,
      label: config.label
    }));
    setMovementTypeOptions(options);
  }, []);

  const loadMovementTypeOptions = useCallback(async (inputValue) => {
    const searchValue = inputValue?.toLowerCase() || '';
    return movementTypeOptions.filter(option =>
      option.label.toLowerCase().includes(searchValue) ||
      option.value.toLowerCase().includes(searchValue)
    );
  }, [movementTypeOptions]);

  // Fetch stats
  const { data: statsData } = useGetStockMovementStatsQuery(
    {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo
    },
    {
      skip: !filters.dateFrom || !filters.dateTo,
    }
  );

  // Mutations
  const [createStockMovementAdjustment, { isLoading: creatingAdjustment }] = useCreateStockMovementAdjustmentMutation();
  const [reverseStockMovement, { isLoading: reversing }] = useReverseStockMovementMutation();

  const handleCreateAdjustment = async () => {
    try {
      await createStockMovementAdjustment(adjustmentData).unwrap();
      toast.success('Stock adjustment created successfully!');
      setShowAdjustmentModal(false);
      setAdjustmentData({
        productId: '',
        movementType: 'adjustment_in',
        quantity: '',
        unitCost: '',
        reason: '',
        notes: '',
        location: 'main_warehouse'
      });
      refetch();
    } catch (error) {
      handleApiError(error, 'Stock Adjustment');
    }
  };

  const handleReverseMovement = async (movement, reason) => {
    try {
      await reverseStockMovement({ id: movement._id, reason }).unwrap();
      toast.success('Stock movement reversed successfully!');
      setSelectedMovement(null);
      refetch();
    } catch (error) {
      handleApiError(error, 'Reverse Movement');
    }
  };

  // Handlers
  const handleFilterChange = (key, value, { silent = false } = {}) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
    if (!silent) {
      executeRefetch();
    }
  };

  const handleSearch = () => {
    executeRefetch();
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      product: '',
      movementType: '',
      dateFrom: defaultDateFrom,
      dateTo: defaultDateTo,
      location: '',
      status: ''
    });
    setCurrentPage(1);
    setTimeout(() => executeRefetch(), 0);
  };

  const handleAdjustmentSubmit = (e) => {
    e.preventDefault();
    handleCreateAdjustment();
  };

  const executeRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  // Movement type configuration
  const movementTypes = {
    'purchase': { label: 'Purchase', icon: ArrowDownLeft, color: 'text-green-600', bg: 'bg-green-100' },
    'sale': { label: 'Sale', icon: ArrowUpRight, color: 'text-red-600', bg: 'bg-red-100' },
    'return_in': { label: 'Customer Return', icon: ArrowDownLeft, color: 'text-blue-600', bg: 'bg-blue-100' },
    'return_out': { label: 'Supplier Return', icon: ArrowUpRight, color: 'text-orange-600', bg: 'bg-orange-100' },
    'adjustment_in': { label: 'Stock Adjustment (+)', icon: Plus, color: 'text-green-600', bg: 'bg-green-100' },
    'adjustment_out': { label: 'Stock Adjustment (-)', icon: Minus, color: 'text-red-600', bg: 'bg-red-100' },
    'transfer_in': { label: 'Transfer In', icon: ArrowDownLeft, color: 'text-purple-600', bg: 'bg-purple-100' },
    'transfer_out': { label: 'Transfer Out', icon: ArrowUpRight, color: 'text-purple-600', bg: 'bg-purple-100' },
    'damage': { label: 'Damage Write-off', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
    'expiry': { label: 'Expiry Write-off', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
    'theft': { label: 'Theft/Loss', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
    'production': { label: 'Production', icon: Package, color: 'text-green-600', bg: 'bg-green-100' },
    'consumption': { label: 'Consumption', icon: Package, color: 'text-orange-600', bg: 'bg-orange-100' },
    'initial_stock': { label: 'Initial Stock', icon: Package, color: 'text-gray-600', bg: 'bg-gray-100' }
  };

  const getMovementIcon = (type) => {
    const config = movementTypes[type];
    if (!config) return Package;
    return config.icon;
  };

  const getMovementColor = (type) => {
    const config = movementTypes[type];
    if (!config) return 'text-gray-600 bg-gray-100';
    return `${config.color} ${config.bg}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  if (isLoading && !movementsData) {
    return <LoadingSpinner />;
  }

  const movements = movementsData?.data?.movements || [];
  const pagination = movementsData?.data?.pagination || {};
  const summary = movementsData?.data?.summary || {};
  const stats = statsData?.data?.overview || {};
  const topProducts = statsData?.data?.topProducts || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Stock Movement Tracking</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Detailed inventory history and movement tracking</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowAdjustmentModal(true)}
            className="btn btn-primary btn-md flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Stock Adjustment
          </button>
          <button className="btn btn-secondary btn-md flex items-center justify-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <div className="card">
          <div className="card-content pt-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-blue-100">
                <Package className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Movements</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{summary.totalMovements || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content pt-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-green-100">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Stock In</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{summary.stockIn || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content pt-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-red-100">
                <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Stock Out</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{summary.stockOut || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content pt-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-purple-100">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Value</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                  {(summary.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-content">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
              <AsyncSelect
                cacheOptions
                defaultOptions={defaultProductOptions}
                loadOptions={loadProductOptions}
                value={getProductOptionById(filters.product)}
                onChange={(option) => handleFilterChange('product', option ? option.value : '', { silent: true })}
                isClearable
                isLoading={productsLoading}
                placeholder="All Products"
                styles={{
                  control: (provided) => ({
                    ...provided,
                    minHeight: '2.5rem'
                  }),
                  menu: (provided) => ({
                    ...provided,
                    zIndex: 30
                  })
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Movement Type</label>
              <AsyncSelect
                cacheOptions
                defaultOptions={movementTypeOptions}
                loadOptions={loadMovementTypeOptions}
                value={
                  filters.movementType
                    ? movementTypeOptions.find(option => option.value === filters.movementType) || null
                    : null
                }
                onChange={(option) => handleFilterChange('movementType', option ? option.value : '', { silent: true })}
                isClearable
                placeholder="All Types"
                styles={{
                  control: (provided) => ({
                    ...provided,
                    minHeight: '2.5rem'
                  }),
                  menu: (provided) => ({
                    ...provided,
                    zIndex: 30
                  })
                }}
              />
            </div>

            <div className="col-span-2">
              <DateFilter
                startDate={filters.dateFrom}
                endDate={filters.dateTo}
                onDateChange={(start, end) => {
                  handleFilterChange('dateFrom', start || '', { silent: true });
                  handleFilterChange('dateTo', end || '', { silent: true });
                }}
                compact={true}
                showPresets={true}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value, { silent: true })}
                className="input"
              >
                <option value="">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>

            <div className="md:col-span-6 flex flex-wrap gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn btn-secondary btn-md flex items-center gap-2"
                disabled={isFetching && !isLoading}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSearch}
                className="btn btn-primary btn-md flex items-center gap-2"
                disabled={isFetching && !isLoading}
              >
                {isFetching && !isLoading ? (
                  <>
                    <LoadingSpinner size="sm" inline className="mr-2" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Search
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="card">
        <div className="card-content">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Movement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock Levels
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {movements.length === 0 && (
                  <tr>
                    <td colSpan="9" className="px-6 py-10 text-center text-gray-500">
                      No stock movements found for the selected filters. Try adjusting your filters and click Search again.
                    </td>
                  </tr>
                )}
                {movements.map((movement) => {
                  const MovementIcon = getMovementIcon(movement.movementType);
                  const movementColor = getMovementColor(movement.movementType);

                  return (
                    <tr key={movement._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-lg ${movementColor}`}>
                            <MovementIcon className="h-4 w-4" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {movementTypes[movement.movementType]?.label || movement.movementType}
                            </div>
                            <div className="text-sm text-gray-500">
                              {movement.location}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {movement.productName}
                          </div>
                          {movement.productSku && (
                            <div className="text-sm text-gray-500">
                              SKU: {movement.productSku}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {movement.quantity}
                        </div>
                        <div className="text-sm text-gray-500">
                          @ {formatCurrency(movement.unitCost)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(movement.totalValue)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {movement.previousStock} → {movement.newStock}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {movement.referenceNumber}
                          </div>
                          <div className="text-sm text-gray-500">
                            {movement.referenceType}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {movement.userName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(movement.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setSelectedMovement(movement)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {movement.status === 'completed' && !movement.isReversal && (
                            <button
                              onClick={() => handleReverseMovement(movement, 'Manual reversal')}
                              className="text-red-600 hover:text-red-900"
                              disabled={reversing}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Showing {((pagination.current - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.current * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={pagination.current === 1}
                  className="btn btn-secondary btn-sm"
                >
                  Previous
                </button>
                <span className="px-3 py-2 text-sm text-gray-700">
                  Page {pagination.current} of {pagination.pages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
                  disabled={pagination.current === pagination.pages}
                  className="btn btn-secondary btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Stock Adjustment</h3>
              <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product *
                  </label>
                  <AsyncSelect
                    cacheOptions
                    defaultOptions={defaultProductOptions}
                    loadOptions={loadProductOptions}
                    value={getProductOptionById(adjustmentData.productId)}
                    onChange={(option) => setAdjustmentData(prev => ({ ...prev, productId: option ? option.value : '' }))}
                    isClearable
                    isLoading={productsLoading}
                    placeholder="Select product"
                    styles={{
                      control: (provided) => ({
                        ...provided,
                        minHeight: '2.5rem'
                      }),
                      menu: (provided) => ({
                        ...provided,
                        zIndex: 30
                      })
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adjustment Type *
                  </label>
                  <select
                    value={adjustmentData.movementType}
                    onChange={(e) => setAdjustmentData(prev => ({ ...prev, movementType: e.target.value }))}
                    className="input"
                    required
                  >
                    <option value="adjustment_in">Stock Increase (+)</option>
                    <option value="adjustment_out">Stock Decrease (-)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={adjustmentData.quantity}
                      onChange={(e) => setAdjustmentData(prev => ({ ...prev, quantity: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit Cost *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={adjustmentData.unitCost}
                      onChange={(e) => setAdjustmentData(prev => ({ ...prev, unitCost: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={adjustmentData.reason}
                    onChange={(e) => setAdjustmentData(prev => ({ ...prev, reason: e.target.value }))}
                    className="input"
                    placeholder="Reason for adjustment"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={adjustmentData.notes}
                    onChange={(e) => setAdjustmentData(prev => ({ ...prev, notes: e.target.value }))}
                    className="input"
                    rows="3"
                    placeholder="Additional notes"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdjustmentModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    isLoading={creatingAdjustment}
                    className="btn btn-primary"
                  >
                    Create Adjustment
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Movement Detail Modal */}
      {selectedMovement && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Movement Details</h3>
                <button
                  onClick={() => setSelectedMovement(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Product</label>
                  <p className="text-sm text-gray-900">{selectedMovement.productName}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Movement Type</label>
                  <p className="text-sm text-gray-900">
                    {movementTypes[selectedMovement.movementType]?.label || selectedMovement.movementType}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Quantity</label>
                  <p className="text-sm text-gray-900">{selectedMovement.quantity}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Total Value</label>
                  <p className="text-sm text-gray-900">{formatCurrency(selectedMovement.totalValue)}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Stock Change</label>
                  <p className="text-sm text-gray-900">
                    {selectedMovement.previousStock} → {selectedMovement.newStock}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Reference</label>
                  <p className="text-sm text-gray-900">{selectedMovement.referenceNumber}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">User</label>
                  <p className="text-sm text-gray-900">{selectedMovement.userName}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Date</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedMovement.createdAt)}</p>
                </div>

                {selectedMovement.reason && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Reason</label>
                    <p className="text-sm text-gray-900">{selectedMovement.reason}</p>
                  </div>
                )}

                ||                {selectedMovement.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Notes</label>
                    <p className="text-sm text-gray-900">{selectedMovement.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
