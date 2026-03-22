import { api } from '../api';

export const inventoryAlertsApi = api.injectEndpoints({
  endpoints: (builder) => ({
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
      providesTags: [{ type: 'Inventory', id: 'LOW_STOCK_ALERTS' }],
    }),
    getAlertSummary: builder.query({
      query: () => ({
        url: 'inventory-alerts/summary',
        method: 'get',
      }),
      providesTags: [{ type: 'Inventory', id: 'ALERT_SUMMARY' }],
    }),
    getProductsNeedingReorder: builder.query({
      query: () => ({
        url: 'inventory-alerts/products-needing-reorder',
        method: 'get',
      }),
      providesTags: [{ type: 'Inventory', id: 'NEED_REORDER' }],
    }),
    generatePurchaseOrders: builder.mutation({
      query: (params) => ({
        url: 'inventory-alerts/generate-purchase-orders',
        method: 'post',
        data: {},
        params,
      }),
      invalidatesTags: [
        { type: 'Orders', id: 'PO_LIST' },
        { type: 'Accounting' },
        { type: 'Inventory', id: 'ALERTS' },
        { type: 'Inventory', id: 'ALERTS_SUMMARY' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Inventory', id: 'LOW_STOCK_ALERTS' },
        { type: 'Inventory', id: 'ALERT_SUMMARY' },
        { type: 'Inventory', id: 'NEED_REORDER' },
        { type: 'Inventory', id: 'MOVEMENTS' },
        { type: 'Inventory', id: 'MOVEMENTS_LIST' },
        { type: 'Inventory', id: 'MOVEMENTS_STATS' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'StockLedger', id: 'LIST' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'STOCK_MOVEMENTS_STATS' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetLowStockAlertsQuery,
  useLazyGetLowStockAlertsQuery,
  useGetAlertSummaryQuery,
  useGetProductsNeedingReorderQuery,
  useGeneratePurchaseOrdersMutation,
} = inventoryAlertsApi;

