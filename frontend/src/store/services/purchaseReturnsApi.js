import { api } from '../api';

export const purchaseReturnsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get all purchase returns
    getPurchaseReturns: builder.query({
      query: (params) => {
        const cleanParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          if (value !== '' && value !== null && value !== undefined) {
            cleanParams[key] = value;
          }
        });
        return {
          url: 'purchase-returns',
          method: 'get',
          params: cleanParams,
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
            ...result.data.map(({ _id, id }) => ({
              type: 'PurchaseReturns',
              id: _id || id,
            })),
            { type: 'PurchaseReturns', id: 'LIST' },
          ]
          : [{ type: 'PurchaseReturns', id: 'LIST' }],
    }),

    // Get single purchase return
    getPurchaseReturn: builder.query({
      query: (id) => ({
        url: `purchase-returns/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'PurchaseReturns', id }],
    }),

    // Create purchase return
    createPurchaseReturn: builder.mutation({
      query: (data) => {
        const { supplierId, ...payload } = data;
        return { url: 'purchase-returns', method: 'post', data: payload };
      },
      invalidatesTags: (result, error, arg) => {
        const tags = [
          { type: 'PurchaseReturns', id: 'LIST' },
          { type: 'PurchaseReturns', id: 'STATS' },
          { type: 'Returns', id: 'LIST' },
          { type: 'Returns', id: 'STATS' },
          { type: 'Returns', id: 'TRENDS' },
          { type: 'Orders', id: 'PI_LIST' },
          { type: 'PurchaseInvoices', id: 'LIST' },
          { type: 'Inventory', id: 'LIST' },
          { type: 'Inventory', id: 'SUMMARY' },
          { type: 'Inventory', id: 'LOW_STOCK' },
          { type: 'Products', id: 'LIST' },
          { type: 'Suppliers', id: 'LIST' },
          { type: 'Accounting', id: 'LEDGER_SUMMARY' },
          { type: 'Accounting', id: 'LEDGER_ENTRIES' },
          { type: 'Accounting', id: 'ALL_ENTRIES' },
          { type: 'ChartOfAccounts', id: 'LIST' },
          { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
          { type: 'Reports', id: 'PARTY_BALANCE' },
          { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
          { type: 'Reports', id: 'PRODUCT_REPORT' },
          { type: 'Reports', id: 'INVENTORY_REPORT' },
        ];
        if (arg?.supplierId) {
          tags.push({ type: 'PurchaseReturns', id: `SUPPLIER_PRODUCTS_${arg.supplierId}` });
        }
        return tags;
      },
    }),

    // Get supplier invoices for return
    getSupplierInvoices: builder.query({
      query: (supplierId) => ({
        url: `purchase-returns/supplier/${supplierId}/invoices`,
        method: 'get',
      }),
      providesTags: (_r, _e, supplierId) => [
        { type: 'PurchaseReturns', id: `SUPPLIER_INVOICES_${supplierId}` },
      ],
    }),

    // Search products purchased from supplier
    searchSupplierProducts: builder.query({
      query: ({ supplierId, search }) => ({
        url: `purchase-returns/supplier/${supplierId}/products`,
        method: 'get',
        params: search ? { search } : {},
      }),
      providesTags: (_r, _e, { supplierId }) => [
        { type: 'PurchaseReturns', id: `SUPPLIER_PRODUCTS_${supplierId}` },
      ],
    }),

    // Approve purchase return
    approvePurchaseReturn: builder.mutation({
      query: ({ returnId, notes }) => ({
        url: `purchase-returns/${returnId}/approve`,
        method: 'put',
        data: { notes },
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'PurchaseReturns', id: returnId },
        { type: 'PurchaseReturns', id: 'LIST' },
        { type: 'PurchaseReturns', id: 'STATS' },
        { type: 'Returns', id: 'LIST' },
        { type: 'Returns', id: 'STATS' },
        { type: 'Returns', id: 'TRENDS' },
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Products', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),

    // Reject purchase return
    rejectPurchaseReturn: builder.mutation({
      query: ({ returnId, reason }) => ({
        url: `purchase-returns/${returnId}/reject`,
        method: 'put',
        data: { reason },
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'PurchaseReturns', id: returnId },
        { type: 'PurchaseReturns', id: 'LIST' },
        { type: 'PurchaseReturns', id: 'STATS' },
        { type: 'Returns', id: 'LIST' },
        { type: 'Returns', id: 'STATS' },
        { type: 'Returns', id: 'TRENDS' },
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Products', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),

    // Process purchase return (complete with accounting)
    processPurchaseReturn: builder.mutation({
      query: ({ returnId, inspection }) => ({
        url: `purchase-returns/${returnId}/process`,
        method: 'put',
        data: { inspection },
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'PurchaseReturns', id: returnId },
        { type: 'PurchaseReturns', id: 'LIST' },
        { type: 'PurchaseReturns', id: 'STATS' },
        { type: 'Returns', id: 'LIST' },
        { type: 'Returns', id: 'STATS' },
        { type: 'Returns', id: 'TRENDS' },
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'PurchaseInvoices', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Products', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),

    // Get purchase return statistics
    getPurchaseReturnStats: builder.query({
      query: (params) => ({
        url: 'purchase-returns/stats/summary',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'PurchaseReturns', id: 'STATS' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPurchaseReturnsQuery,
  useGetPurchaseReturnQuery,
  useLazyGetPurchaseReturnQuery,
  useCreatePurchaseReturnMutation,
  useGetSupplierInvoicesQuery,
  useSearchSupplierProductsQuery,
  useLazySearchSupplierProductsQuery,
  useApprovePurchaseReturnMutation,
  useRejectPurchaseReturnMutation,
  useProcessPurchaseReturnMutation,
  useGetPurchaseReturnStatsQuery,
} = purchaseReturnsApi;
