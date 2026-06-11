import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Filter,

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
  useGetProductStockMovementsQuery,
  useGetStockReconciliationQuery,
  useGetStockMovementStatsQuery,
  useCreateStockMovementAdjustmentMutation,
  useReverseStockMovementMutation,
} from '../store/services/inventoryApi';
import { useLazyGetProductsQuery } from '../store/services/productsApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner, LoadingButton, LoadingPage } from '../components/LoadingSpinner';
import { handleApiError } from '../utils/errorHandler';
import { toast } from 'sonner';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, getDateDaysAgo } from '../utils/dateUtils';
import { useCursorPagination } from '../hooks/useCursorPagination';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';

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
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [showReconciliation, setShowReconciliation] = useState(false);
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

  const {
    currentPage,
    currentCursor,
    updateFromPagination,
    getUiPagination,
    goToPage,
  } = useCursorPagination([JSON.stringify(filters)]);

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
      cursor: currentCursor,
      limit: 50
    },
    {
      onError: (error) => handleApiError(error, 'Stock Movements')
    }
  );

  const {
    data: productMovementsData,
    isFetching: productMovementsFetching,
  } = useGetProductStockMovementsQuery(
    {
      productId: filters.product,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      movementType: filters.movementType || undefined,
    },
    { skip: !filters.product }
  );

  const {
    data: reconciliationData,
    isFetching: reconciliationFetching,
    refetch: refetchReconciliation,
  } = useGetStockReconciliationQuery(
    { limit: 100, onlyMismatches: true },
    { skip: !showReconciliation }
  );

  const [movementTypeOptions, setMovementTypeOptions] = useState([]);

  const [triggerProducts] = useLazyGetProductsQuery();
  const [productMap, setProductMap] = useState(new Map());

  const formatProductOption = useCallback((product) => {
    if (!product) return null;
    const parts = [product.name];
    if (product.sku) {
      parts.push(`SKU: ${product.sku}`);
    }
    return {
      value: product.id || product._id,
      label: parts.join(' • ')
    };
  }, []);

  const defaultProductOptions = useMemo(() => {
    return Array.from(productMap.values()).map(formatProductOption).filter(Boolean);
  }, [productMap, formatProductOption]);

  const loadProductOptions = useCallback(async (inputValue) => {
    const term = String(inputValue ?? '').trim();
    try {
      const params = {
        status: 'active',
        limit: 50,
        page: 1,
        listMode: 'minimal',
      };
      if (term.length > 0) {
        params.search = term;
      }
      const res = await triggerProducts(params).unwrap();
      const products = res?.products ?? res?.data?.products ?? [];
      if (Array.isArray(products) && products.length > 0) {
        setProductMap((prev) => {
          const next = new Map(prev);
          products.forEach((product) => {
            const pid = product.id || product._id;
            if (pid) next.set(pid, product);
          });
          return next;
        });
      }
      return products.map(formatProductOption).filter(Boolean);
    } catch (error) {
      handleApiError(error, 'Products');
      return [];
    }
  }, [formatProductOption, triggerProducts]);

  const getProductOptionById = useCallback((productId) => {
    if (!productId) return null;
    const product = productMap.get(productId);
    return product ? formatProductOption(product) : null;
  }, [productMap, formatProductOption]);

  useEffect(() => {
    if (!showAdjustmentModal) return;
    loadProductOptions('');
  }, [showAdjustmentModal, loadProductOptions]);

  const asyncSelectMenuPortalStyles = {
    menuPortal: (base) => ({ ...base, zIndex: 60 }),
    menu: (base) => ({ ...base, zIndex: 60 }),
  };

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
      await reverseStockMovement({ id: movement.id || movement._id, reason }).unwrap();
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
    const val = parseFloat(amount);
    if (isNaN(val)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const formatDate = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  const movements = movementsData?.data?.movements || [];
  const rawPagination = movementsData?.data?.pagination || {};
  const pagination = getUiPagination(rawPagination, 20);
  const summary = movementsData?.data?.summary || {};
  const productDrilldown = productMovementsData?.data;
  const productDrilldownMovements = productDrilldown?.movements || [];
  const reconciliationRows = reconciliationData?.data?.rows || [];
  const reconciliationSummary = reconciliationData?.data?.summary || {};
  const stats = statsData?.data?.overview || {};
  const topProducts = statsData?.data?.topProducts || [];

  const STOCK_IN_TYPES = useMemo(
    () => new Set(['purchase', 'return_in', 'adjustment_in', 'transfer_in', 'production', 'initial_stock']),
    []
  );

  useEffect(() => {
    updateFromPagination(rawPagination);
  }, [rawPagination, updateFromPagination]);

  if (isLoading && !movementsData) {
    return <LoadingPage useSpinningText={false} />;
  }

  return (
    <PageLayout>
      <PageHeader
        title="Stock Movement Tracking"
        subtitle="Detailed inventory history and movement tracking"
        icon={Package}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={showReconciliation ? 'default' : 'outline'}
              size="default"
              onClick={() => {
                setShowReconciliation((v) => !v);
                if (!showReconciliation) refetchReconciliation();
              }}
              className="flex items-center gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              Reconciliation
            </Button>
            <Button
              onClick={() => setShowAdjustmentModal(true)}
              variant="default"
              size="default"
              className="flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Stock Adjustment
            </Button>
          </div>
        )}
      />

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
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{summary.totalMovements || summary.total_movements || 0}</p>
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
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{summary.stockIn || summary.stock_in || 0}</p>
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
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{summary.stockOut || summary.stock_out || 0}</p>
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
                  {(summary.totalValue || summary.total_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showReconciliation && (
        <div className="card border-amber-200">
          <div className="card-content">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Stock Reconciliation</h3>
                <p className="text-sm text-gray-500">
                  Compares current inventory with the last movement balance per product.
                </p>
              </div>
              {reconciliationFetching ? <LoadingSpinner size="sm" /> : null}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">Checked</p>
                <p className="text-xl font-semibold">{reconciliationSummary.totalChecked ?? 0}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <p className="text-xs text-green-700">Matched</p>
                <p className="text-xl font-semibold text-green-800">{reconciliationSummary.matchedCount ?? 0}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="text-xs text-red-700">Mismatches</p>
                <p className="text-xl font-semibold text-red-800">{reconciliationSummary.mismatchCount ?? 0}</p>
              </div>
            </div>
            {reconciliationRows.length === 0 ? (
              <p className="text-sm text-green-700 bg-green-50 rounded-lg p-4">
                No mismatches found — inventory matches the last recorded movement balances.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Product</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Inventory</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Last Movement</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reconciliationRows.map((row) => (
                      <tr key={row.productId} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div className="font-medium">{row.productName}</div>
                          <div className="text-xs text-gray-500">{row.productModel}</div>
                        </td>
                        <td className="px-4 py-2 text-right">{Number(row.inventoryStock).toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">{Number(row.lastMovementStock).toFixed(2)}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${row.hasMismatch ? 'text-red-600' : 'text-green-600'}`}>
                          {Number(row.difference).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {filters.product && (
        <div className="card border-blue-200">
          <div className="card-content">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Product Movement History</h3>
                <p className="text-sm text-gray-500">
                  {productDrilldown?.product?.name || getProductOptionById(filters.product)?.label || 'Selected product'}
                  {productDrilldown?.product?.productModel === 'ProductVariant' ? ' (Variant)' : ''}
                </p>
              </div>
              <div className="text-sm text-gray-600">
                Current stock: <span className="font-semibold">{Number(productDrilldown?.currentStock ?? 0).toFixed(2)}</span>
              </div>
            </div>
            {productMovementsFetching ? (
              <LoadingSpinner />
            ) : productDrilldownMovements.length === 0 ? (
              <p className="text-sm text-gray-500">No movements for this product in the selected date range.</p>
            ) : (
              <div className="table-scroll">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Qty In</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Qty Out</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Balance</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {productDrilldownMovements.map((m) => {
                      const type = m.movementType || m.movement_type;
                      const isIn = STOCK_IN_TYPES.has(type);
                      return (
                        <tr key={m.id || m._id}>
                          <td className="px-4 py-2 whitespace-nowrap">{formatDate(m.createdAt || m.created_at)}</td>
                          <td className="px-4 py-2">{movementTypes[type]?.label || type}</td>
                          <td className="px-4 py-2 text-right text-green-700">{isIn ? Number(m.quantity).toFixed(2) : '—'}</td>
                          <td className="px-4 py-2 text-right text-red-700">{!isIn ? Number(m.quantity).toFixed(2) : '—'}</td>
                          <td className="px-4 py-2 text-right font-medium">{Number(m.newStock ?? m.new_stock ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-2">{m.referenceNumber || m.reference_number || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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
                isLoading={false}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
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
              <Button
                type="button"
                onClick={handleResetFilters}
                variant="secondary"
                size="default"
                className="flex items-center gap-2"
                disabled={isFetching && !isLoading}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <LoadingButton
                type="button"
                onClick={handleSearch}
                variant="default"
                size="default"
                className="flex items-center gap-2"
                isLoading={isFetching && !isLoading}
                loadingText="Searching..."
                disabled={isFetching && !isLoading}
              >
                <>
                  <Search className="h-4 w-4" />
                  Search
                </>
              </LoadingButton>
            </div>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="card">
        <div className="card-content">
          <div className="table-scroll">
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
                  const MovementIcon = getMovementIcon(movement.movementType || movement.movement_type);
                  const movementColor = getMovementColor(movement.movementType || movement.movement_type);

                  return (
                    <tr key={movement.id || movement._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-lg ${movementColor}`}>
                            <MovementIcon className="h-4 w-4" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {movementTypes[movement.movementType || movement.movement_type]?.label || movement.movementType || movement.movement_type}
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
                            {movement.productName || movement.product_name || '—'}
                          </div>
                          {(movement.productSku || movement.product_sku) && (
                            <div className="text-sm text-gray-500">
                              SKU: {movement.productSku || movement.product_sku}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {parseFloat(movement.quantity || 0).toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-500">
                          @ {formatCurrency(movement.unitCost || movement.unit_cost)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(movement.totalValue || movement.total_value)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {movement.previousStock ?? movement.previous_stock ?? 0} → {movement.newStock ?? movement.new_stock ?? 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {movement.referenceNumber || movement.reference_number || '—'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {movement.referenceType || movement.reference_type || '—'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {movement.userName || movement.user_name || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(movement.createdAt || movement.created_at)}
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
                <Button
                  onClick={() => goToPage(currentPage - 1, pagination.hasNext)}
                  disabled={pagination.current === 1}
                  variant="secondary"
                  size="sm"
                >
                  Previous
                </Button>
                <span className="px-3 py-2 text-sm text-gray-700">
                  Page {pagination.current} of {pagination.pages}
                </span>
                <Button
                  onClick={() => goToPage(currentPage + 1, pagination.hasNext)}
                  disabled={pagination.current === pagination.pages}
                  variant="secondary"
                  size="sm"
                >
                  Next
                </Button>
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
                    defaultOptions
                    loadOptions={loadProductOptions}
                    value={getProductOptionById(adjustmentData.productId)}
                    onChange={(option) => setAdjustmentData(prev => ({ ...prev, productId: option ? option.value : '' }))}
                    isClearable
                    isLoading={false}
                    placeholder="Search or select product"
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    menuPosition="fixed"
                    styles={{
                      control: (provided) => ({
                        ...provided,
                        minHeight: '2.5rem'
                      }),
                      ...asyncSelectMenuPortalStyles,
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
                    <Input
                      type="number"
                      step="0.01"
                      min={0.01}
                      value={adjustmentData.quantity}
                      onChange={(e) => setAdjustmentData(prev => ({ ...prev, quantity: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit Cost *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={adjustmentData.unitCost}
                      onChange={(e) => setAdjustmentData(prev => ({ ...prev, unitCost: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason
                  </label>
                  <Input
                    type="text"
                    value={adjustmentData.reason}
                    onChange={(e) => setAdjustmentData(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Reason for adjustment"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <Textarea
                    value={adjustmentData.notes}
                    onChange={(e) => setAdjustmentData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Additional notes"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    type="button"
                    onClick={() => setShowAdjustmentModal(false)}
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                  <LoadingButton
                    type="submit"
                    isLoading={creatingAdjustment}
                    variant="default"
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

                {selectedMovement.notes && (
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
    </PageLayout>
  );
};
