import { api } from '../api';

export const inventoryApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getInventory: builder.query({
      query: (params) => {
        // Filter out empty string parameters
        const filteredParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          // Only include non-empty values (skip empty strings, null, undefined)
          if (value !== '' && value !== null && value !== undefined) {
            filteredParams[key] = value;
          }
        });
        return {
          url: 'inventory',
          method: 'get',
          params: filteredParams,
        };
      },
      keepUnusedDataFor: 60,
      providesTags: (result) =>
        result?.data?.items
          ? [
              ...result.data.items.map(({ _id, id }) => ({ type: 'Inventory', id: _id || id })),
              { type: 'Inventory', id: 'LIST' },
            ]
          : [{ type: 'Inventory', id: 'LIST' }],
    }),
    getInventorySummary: builder.query({
      query: () => ({
        url: 'inventory/summary',
        method: 'get',
      }),
      keepUnusedDataFor: 120,
      providesTags: [{ type: 'Inventory', id: 'SUMMARY' }],
    }),
    getLowStockItems: builder.query({
      query: () => ({
        url: 'inventory/low-stock',
        method: 'get',
      }),
      keepUnusedDataFor: 120,
      providesTags: [{ type: 'Inventory', id: 'LOW_STOCK' }],
    }),
    createStockAdjustment: builder.mutation({
      query: (data) => ({
        url: 'inventory/stock-adjustments',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Inventory', id: 'MOVEMENTS' },
        { type: 'Inventory', id: 'MOVEMENTS_LIST' },
        { type: 'Inventory', id: 'MOVEMENTS_STATS' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'StockLedger', id: 'LIST' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'STOCK_MOVEMENTS_STATS' },
      ],
    }),
    updateStock: builder.mutation({
      query: (data) => ({
        url: 'inventory/update-stock',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Inventory', id: 'MOVEMENTS' },
        { type: 'Inventory', id: 'MOVEMENTS_LIST' },
        { type: 'Inventory', id: 'MOVEMENTS_STATS' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'StockLedger', id: 'LIST' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'STOCK_MOVEMENTS_STATS' },
      ],
    }),
    // Inventory Alerts
    getLowStockAlerts: builder.query({
      query: (params) => {
        // Filter out empty string parameters
        const filteredParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          // Only include non-empty values (skip empty strings, null, undefined)
          if (value !== '' && value !== null && value !== undefined) {
            filteredParams[key] = value;
          }
        });
        return {
          url: 'inventory-alerts',
          method: 'get',
          params: filteredParams,
        };
      },
      providesTags: [{ type: 'Inventory', id: 'ALERTS' }],
    }),
    getAlertSummary: builder.query({
      query: () => ({
        url: 'inventory-alerts/summary',
        method: 'get',
      }),
      providesTags: [{ type: 'Inventory', id: 'ALERTS_SUMMARY' }],
    }),
    generatePurchaseOrders: builder.mutation({
      query: (params) => ({
        url: 'inventory-alerts/generate-purchase-orders',
        method: 'post',
        params,
      }),
      invalidatesTags: [
        { type: 'Inventory', id: 'ALERTS' },
        { type: 'Inventory', id: 'ALERTS_SUMMARY' },
        { type: 'Inventory', id: 'MOVEMENTS' },
        { type: 'Inventory', id: 'MOVEMENTS_LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'Orders', id: 'PO_LIST' },
        { type: 'StockLedger', id: 'LIST' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'STOCK_MOVEMENTS_STATS' },
      ],
    }),
    // Stock Ledger
    getStockLedger: builder.query({
      query: (params) => {
        // Filter out empty string parameters
        const filteredParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          // Only include non-empty values (skip empty strings, null, undefined)
          if (value !== '' && value !== null && value !== undefined) {
            filteredParams[key] = value;
          }
        });
        return {
          url: 'stock-ledger',
          method: 'get',
          params: filteredParams,
        };
      },
      keepUnusedDataFor: 60,
      providesTags: [{ type: 'StockLedger', id: 'LIST' }],
    }),
    // Stock Movements
    getStockMovements: builder.query({
      query: (params) => {
        // Filter out empty string parameters
        const filteredParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          // Only include non-empty values (skip empty strings, null, undefined)
          if (value !== '' && value !== null && value !== undefined) {
            filteredParams[key] = value;
          }
        });
        if (!filteredParams.listMode) {
          filteredParams.listMode = 'minimal';
        }
        return {
          url: 'stock-movements',
          method: 'get',
          params: filteredParams,
        };
      },
      keepUnusedDataFor: 60,
      providesTags: [{ type: 'Inventory', id: 'MOVEMENTS' }],
    }),
    getStockMovementStats: builder.query({
      query: (params) => {
        // Filter out empty string parameters
        const filteredParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          // Only include non-empty values (skip empty strings, null, undefined)
          if (value !== '' && value !== null && value !== undefined) {
            filteredParams[key] = value;
          }
        });
        return {
          url: 'stock-movements/stats/overview',
          method: 'get',
          params: filteredParams,
        };
      },
      providesTags: [{ type: 'Inventory', id: 'MOVEMENTS_STATS' }],
    }),
    createStockMovement: builder.mutation({
      query: (data) => ({
        url: 'stock-movements',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Inventory', id: 'MOVEMENTS' },
        { type: 'Inventory', id: 'MOVEMENTS_LIST' },
        { type: 'Inventory', id: 'MOVEMENTS_STATS' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'StockLedger', id: 'LIST' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'STOCK_MOVEMENTS_STATS' },
      ],
    }),
    createStockMovementAdjustment: builder.mutation({
      query: (data) => ({
        url: 'stock-movements/adjustment',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Inventory', id: 'MOVEMENTS' },
        { type: 'Inventory', id: 'MOVEMENTS_LIST' },
        { type: 'Inventory', id: 'MOVEMENTS_STATS' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'StockLedger', id: 'LIST' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'STOCK_MOVEMENTS_STATS' },
      ],
    }),
    reverseStockMovement: builder.mutation({
      query: ({ id, reason }) => ({
        url: `stock-movements/${id}/reverse`,
        method: 'post',
        data: { reason },
      }),
      invalidatesTags: [
        { type: 'Inventory', id: 'MOVEMENTS' },
        { type: 'Inventory', id: 'MOVEMENTS_LIST' },
        { type: 'Inventory', id: 'MOVEMENTS_STATS' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'StockLedger', id: 'LIST' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'STOCK_MOVEMENTS_STATS' },
      ],
    }),
    // Inventory Reports
    getReports: builder.query({
      query: (params) => {
        // Filter out empty string parameters
        const filteredParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          // Only include non-empty values (skip empty strings, null, undefined)
          if (value !== '' && value !== null && value !== undefined) {
            filteredParams[key] = value;
          }
        });
        return {
          url: 'inventory-reports',
          method: 'get',
          params: filteredParams,
        };
      },
      providesTags: [{ type: 'Inventory', id: 'REPORTS' }],
    }),
    getReport: builder.query({
      query: (id) => ({
        url: `inventory-reports/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'Inventory', id: `REPORT_${id}` }],
    }),
    getQuickSummary: builder.query({
      query: () => ({
        url: 'inventory-reports/quick/summary',
        method: 'get',
      }),
      providesTags: [{ type: 'Inventory', id: 'REPORTS_SUMMARY' }],
    }),
    getQuickStockLevels: builder.query({
      query: (params) => {
        // Filter out empty string parameters
        const filteredParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          // Only include non-empty values (skip empty strings, null, undefined)
          if (value !== '' && value !== null && value !== undefined) {
            filteredParams[key] = value;
          }
        });
        return {
          url: 'inventory-reports/quick/stock-levels',
          method: 'get',
          params: filteredParams,
        };
      },
      providesTags: [{ type: 'Inventory', id: 'REPORTS_STOCK_LEVELS' }],
    }),
    getQuickTurnoverRates: builder.query({
      query: (params) => {
        // Filter out empty string parameters
        const filteredParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          // Only include non-empty values (skip empty strings, null, undefined)
          if (value !== '' && value !== null && value !== undefined) {
            filteredParams[key] = value;
          }
        });
        return {
          url: 'inventory-reports/quick/turnover-rates',
          method: 'get',
          params: filteredParams,
        };
      },
      providesTags: [{ type: 'Inventory', id: 'REPORTS_TURNOVER' }],
    }),
    getQuickAgingAnalysis: builder.query({
      query: (params) => {
        // Filter out empty string parameters
        const filteredParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          // Only include non-empty values (skip empty strings, null, undefined)
          if (value !== '' && value !== null && value !== undefined) {
            filteredParams[key] = value;
          }
        });
        return {
          url: 'inventory-reports/quick/aging-analysis',
          method: 'get',
          params: filteredParams,
        };
      },
      providesTags: [{ type: 'Inventory', id: 'REPORTS_AGING' }],
    }),
    createReport: builder.mutation({
      query: (data) => ({
        url: 'inventory-reports/generate',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Inventory', id: 'REPORTS' },
        { type: 'Inventory', id: 'REPORTS_SUMMARY' },
      ],
    }),
    deleteReport: builder.mutation({
      query: (id) => ({
        url: `inventory-reports/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Inventory', id: 'REPORTS' },
        { type: 'Inventory', id: 'REPORTS_SUMMARY' },
        { type: 'Inventory', id: `REPORT_${id}` },
      ],
    }),
    toggleFavoriteReport: builder.mutation({
      query: ({ reportId, isFavorite }) => ({
        url: `inventory-reports/${reportId}/favorite`,
        method: 'put',
        data: { isFavorite },
      }),
      invalidatesTags: (_r, _e, { reportId }) => [
        { type: 'Inventory', id: 'REPORTS' },
        { type: 'Inventory', id: `REPORT_${reportId}` },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetInventoryQuery,
  useGetInventorySummaryQuery,
  useGetLowStockItemsQuery,
  useCreateStockAdjustmentMutation,
  useUpdateStockMutation,
  useGetLowStockAlertsQuery,
  useGetAlertSummaryQuery,
  useGeneratePurchaseOrdersMutation,
  useGetStockLedgerQuery,
  useGetStockMovementsQuery,
  useGetStockMovementStatsQuery,
  useCreateStockMovementMutation,
  useCreateStockMovementAdjustmentMutation,
  useReverseStockMovementMutation,
  useGetReportsQuery,
  useGetReportQuery,
  useGetQuickSummaryQuery,
  useGetQuickStockLevelsQuery,
  useGetQuickTurnoverRatesQuery,
  useGetQuickAgingAnalysisQuery,
  useCreateReportMutation, 
  useDeleteReportMutation, 
  useToggleFavoriteReportMutation,
} = inventoryApi;

