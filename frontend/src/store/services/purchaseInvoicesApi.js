import { api } from '../api';

/** Normalize supplier id for cache tags (string or populated object) */
function supplierTagId(supplier) {
  if (supplier == null) return null;
  if (typeof supplier === 'object') {
    return supplier._id || supplier.id || null;
  }
  return supplier;
}

export const purchaseInvoicesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getPurchaseInvoices: builder.query({
      query: (params) => ({
        url: 'purchase-invoices',
        method: 'get',
        params: {
          listMode: 'minimal',
          ...params,
        },
      }),
      keepUnusedDataFor: 60,
      providesTags: (result) =>
        result?.data?.purchaseInvoices
          ? [
            ...result.data.purchaseInvoices.map(({ _id, id }) => ({
              type: 'Orders',
              id: _id || id,
            })),
            { type: 'Orders', id: 'PI_LIST' },
          ]
          : [{ type: 'Orders', id: 'PI_LIST' }],
    }),
    getPurchaseInvoice: builder.query({
      query: (id) => ({
        url: `purchase-invoices/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Orders', id }],
    }),
    createPurchaseInvoice: builder.mutation({
      query: (data) => ({
        url: 'purchase-invoices',
        method: 'post',
        data,
      }),
      invalidatesTags: (result, error, arg) => {
        const tags = [
          { type: 'Orders', id: 'PI_LIST' },
          { type: 'Products', id: 'LIST' },
          { type: 'Suppliers', id: 'LIST' },
          { type: 'Suppliers', id: 'SEARCH' },
          { type: 'Suppliers', id: 'ACTIVE' },
          { type: 'Inventory', id: 'LIST' },
          { type: 'Inventory', id: 'SUMMARY' },
          { type: 'Inventory', id: 'LOW_STOCK' },
          { type: 'Accounting' },
          { type: 'Accounting', id: 'LEDGER_SUMMARY' },
          { type: 'Accounting', id: 'LEDGER_ENTRIES' },
          { type: 'Accounting', id: 'ALL_ENTRIES' },
          { type: 'Accounting', id: 'TRIAL_BALANCE' },
          { type: 'ChartOfAccounts', id: 'LIST' },
          { type: 'ChartOfAccounts', id: 'STATS' },
          { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
          { type: 'Reports', id: 'PARTY_BALANCE' },
          { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
          { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
          { type: 'Reports', id: 'PRODUCT_REPORT' },
          { type: 'Reports', id: 'INVENTORY_REPORT' },
          { type: 'Reports', id: 'SUMMARY_CARDS' },
          { type: 'Reports', id: 'FINANCIAL_REPORT' },
          { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
        ];
        const sid =
          supplierTagId(arg?.supplier) ||
          supplierTagId(result?.data?.invoice?.supplier) ||
          supplierTagId(result?.invoice?.supplier);
        if (sid) {
          tags.push({ type: 'Suppliers', id: sid });
        }
        return tags;
      },
    }),
    updatePurchaseInvoice: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `purchase-invoices/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (result, error, arg) => {
        const { id, supplier } = arg || {};
        const tags = [
          { type: 'Orders', id },
          { type: 'Orders', id: 'PI_LIST' },
          { type: 'Products', id: 'LIST' },
          { type: 'Suppliers', id: 'LIST' },
          { type: 'Suppliers', id: 'SEARCH' },
          { type: 'Suppliers', id: 'ACTIVE' },
          { type: 'Inventory', id: 'LIST' },
          { type: 'Inventory', id: 'SUMMARY' },
          { type: 'Inventory', id: 'LOW_STOCK' },
          { type: 'Accounting' },
          { type: 'Accounting', id: 'LEDGER_SUMMARY' },
          { type: 'Accounting', id: 'LEDGER_ENTRIES' },
          { type: 'Accounting', id: 'ALL_ENTRIES' },
          { type: 'Accounting', id: 'TRIAL_BALANCE' },
          { type: 'ChartOfAccounts', id: 'LIST' },
          { type: 'ChartOfAccounts', id: 'STATS' },
          { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
          { type: 'Reports', id: 'PARTY_BALANCE' },
          { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
          { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
          { type: 'Reports', id: 'PRODUCT_REPORT' },
          { type: 'Reports', id: 'INVENTORY_REPORT' },
          { type: 'Reports', id: 'SUMMARY_CARDS' },
          { type: 'Reports', id: 'FINANCIAL_REPORT' },
          { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
        ];
        const sid =
          supplierTagId(supplier) ||
          supplierTagId(result?.data?.invoice?.supplier) ||
          supplierTagId(result?.invoice?.supplier);
        if (sid) {
          tags.push({ type: 'Suppliers', id: sid });
        }
        return tags;
      },
    }),
    deletePurchaseInvoice: builder.mutation({
      query: (id) => ({
        url: `purchase-invoices/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Products', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Suppliers', id: 'SEARCH' },
        { type: 'Suppliers', id: 'ACTIVE' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
      ],
    }),
    confirmPurchaseInvoice: builder.mutation({
      query: (id) => ({
        url: `purchase-invoices/${id}/confirm`,
        method: 'put',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Products', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Suppliers', id: 'SEARCH' },
        { type: 'Suppliers', id: 'ACTIVE' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
      ],
    }),
    cancelPurchaseInvoice: builder.mutation({
      query: (id) => ({
        url: `purchase-invoices/${id}/cancel`,
        method: 'put',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Products', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Suppliers', id: 'SEARCH' },
        { type: 'Suppliers', id: 'ACTIVE' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
      ],
    }),
    syncPurchaseInvoicesLedger: builder.mutation({
      query: (params = {}) => ({
        url: 'purchase-invoices/sync-ledger',
        method: 'post',
        params: params?.dateFrom || params?.dateTo ? { dateFrom: params.dateFrom, dateTo: params.dateTo } : undefined,
      }),
      invalidatesTags: [
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPurchaseInvoicesQuery,
  useLazyGetPurchaseInvoicesQuery,
  useGetPurchaseInvoiceQuery,
  useLazyGetPurchaseInvoiceQuery,
  useCreatePurchaseInvoiceMutation,
  useUpdatePurchaseInvoiceMutation,
  useDeletePurchaseInvoiceMutation,
  useConfirmPurchaseInvoiceMutation,
  useCancelPurchaseInvoiceMutation,
  useSyncPurchaseInvoicesLedgerMutation,
} = purchaseInvoicesApi;

