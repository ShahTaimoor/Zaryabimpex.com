import { api } from '../api';

export const purchaseOrdersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getPurchaseOrders: builder.query({
      query: (params) => ({
        url: 'purchase-orders',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.purchaseOrders
          ? [
              ...result.data.purchaseOrders.map(({ _id, id }) => ({
                type: 'Orders',
                id: _id || id,
              })),
              { type: 'Orders', id: 'PO_LIST' },
            ]
          : [{ type: 'Orders', id: 'PO_LIST' }],
    }),
    getPurchaseOrder: builder.query({
      query: (id) => ({
        url: `purchase-orders/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Orders', id }],
    }),
    createPurchaseOrder: builder.mutation({
      query: (data) => ({
        url: 'purchase-orders',
        method: 'post',
        data,
      }),
      invalidatesTags: (result, error, arg) => {
        const tags = [
          { type: 'Orders', id: 'PO_LIST' },
          { type: 'Suppliers', id: 'LIST' },
          { type: 'Inventory', id: 'LIST' },
          { type: 'Inventory', id: 'SUMMARY' },
          { type: 'Inventory', id: 'LOW_STOCK' },
          { type: 'Products', id: 'LIST' },
          { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
          { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
          { type: 'Reports', id: 'PARTY_BALANCE' },
          { type: 'Reports', id: 'INVENTORY_REPORT' },
          { type: 'Reports', id: 'PRODUCT_REPORT' },
          { type: 'Reports', id: 'SUMMARY_CARDS' },
        ];
        if (arg?.supplier) {
          tags.push({ type: 'Suppliers', id: arg.supplier });
        }
        return tags;
      },
    }),
    updatePurchaseOrder: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `purchase-orders/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_res, _err, { id, supplier }) => {
        const tags = [
          { type: 'Orders', id },
          { type: 'Orders', id: 'PO_LIST' },
          { type: 'Suppliers', id: 'LIST' },
          { type: 'Inventory', id: 'LIST' },
          { type: 'Inventory', id: 'SUMMARY' },
          { type: 'Products', id: 'LIST' },
          { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
          { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
          { type: 'Reports', id: 'PARTY_BALANCE' },
          { type: 'Reports', id: 'INVENTORY_REPORT' },
          { type: 'Reports', id: 'PRODUCT_REPORT' },
          { type: 'Reports', id: 'SUMMARY_CARDS' },
        ];
        if (supplier) {
          tags.push({ type: 'Suppliers', id: supplier });
        }
        return tags;
      },
    }),
    deletePurchaseOrder: builder.mutation({
      query: (id) => ({
        url: `purchase-orders/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'PO_LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Products', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    confirmPurchaseOrder: builder.mutation({
      query: (id) => ({
        url: `purchase-orders/${id}/confirm`,
        method: 'put',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'PO_LIST' },
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Products', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
      ],
    }),
    cancelPurchaseOrder: builder.mutation({
      query: (id) => ({
        url: `purchase-orders/${id}/cancel`,
        method: 'put',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'PO_LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Products', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    closePurchaseOrder: builder.mutation({
      query: (id) => ({
        url: `purchase-orders/${id}/close`,
        method: 'put',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'PO_LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Products', id: 'LIST' },
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
    getConversionData: builder.query({
      query: (id) => ({
        url: `purchase-orders/${id}/convert`,
        method: 'get',
      }),
    }),
    convertToPurchase: builder.mutation({
      query: ({ id, data }) => ({
        url: `purchase-orders/${id}/convert`,
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Orders', id: 'PO_LIST' },
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Products', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'StockLedger', id: 'LIST' },
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
  }),
  overrideExisting: false,
});

export const {
  useGetPurchaseOrdersQuery,
  useGetPurchaseOrderQuery,
  useLazyGetPurchaseOrderQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  useDeletePurchaseOrderMutation,
  useConfirmPurchaseOrderMutation,
  useCancelPurchaseOrderMutation,
  useClosePurchaseOrderMutation,
  useGetConversionDataQuery,
  useConvertToPurchaseMutation,
} = purchaseOrdersApi;

