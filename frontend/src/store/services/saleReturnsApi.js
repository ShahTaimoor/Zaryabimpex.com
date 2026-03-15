import { api } from '../api';

export const saleReturnsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get all sale returns
    getSaleReturns: builder.query({
      query: (params) => {
        const cleanParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          if (value !== '' && value !== null && value !== undefined) {
            cleanParams[key] = value;
          }
        });
        return {
          url: 'sale-returns',
          method: 'get',
          params: cleanParams,
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
            ...result.data.map(({ _id, id }) => ({
              type: 'SaleReturns',
              id: _id || id,
            })),
            { type: 'SaleReturns', id: 'LIST' },
          ]
          : [{ type: 'SaleReturns', id: 'LIST' }],
    }),

    // Get single sale return
    getSaleReturn: builder.query({
      query: (id) => ({
        url: `sale-returns/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'SaleReturns', id }],
    }),

    // Create sale return
    createSaleReturn: builder.mutation({
      query: (data) => {
        const { customerId, ...payload } = data;
        return { url: 'sale-returns', method: 'post', data: payload };
      },
      invalidatesTags: (result, error, arg) => {
        const tags = [
          { type: 'SaleReturns', id: 'LIST' },
          { type: 'SaleReturns', id: 'STATS' },
          { type: 'Returns', id: 'LIST' },
          { type: 'Returns', id: 'STATS' },
          { type: 'Returns', id: 'TRENDS' },
          { type: 'Sales', id: 'LIST' },
          { type: 'Inventory', id: 'LIST' },
          { type: 'Inventory', id: 'SUMMARY' },
          { type: 'Inventory', id: 'LOW_STOCK' },
          { type: 'Products', id: 'LIST' },
          { type: 'Customers', id: 'LIST' },
          { type: 'Accounting', id: 'LEDGER_SUMMARY' },
          { type: 'Accounting', id: 'LEDGER_ENTRIES' },
          { type: 'Accounting', id: 'ALL_ENTRIES' },
          { type: 'Accounting', id: 'TRIAL_BALANCE' },
          { type: 'ChartOfAccounts', id: 'LIST' },
          { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
          { type: 'Reports', id: 'PARTY_BALANCE' },
          { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
          { type: 'Reports', id: 'SALES_REPORT' },
          { type: 'Reports', id: 'PRODUCT_REPORT' },
          { type: 'Reports', id: 'CUSTOMER_REPORT' },
          { type: 'Reports', id: 'INVENTORY_REPORT' },
          { type: 'Reports', id: 'SUMMARY_CARDS' },
          { type: 'Reports', id: 'FINANCIAL_REPORT' },
        ];
        if (arg?.customerId) {
          tags.push({ type: 'SaleReturns', id: `CUSTOMER_PRODUCTS_${arg.customerId}` });
        }
        return tags;
      },
    }),

    // Get customer invoices for return
    getCustomerInvoices: builder.query({
      query: (customerId) => ({
        url: `sale-returns/customer/${customerId}/invoices`,
        method: 'get',
      }),
      providesTags: (_r, _e, customerId) => [
        { type: 'SaleReturns', id: `CUSTOMER_INVOICES_${customerId}` },
      ],
    }),

    // Search products sold to customer
    searchCustomerProducts: builder.query({
      query: ({ customerId, search }) => ({
        url: `sale-returns/customer/${customerId}/products`,
        method: 'get',
        params: search ? { search } : {},
      }),
      providesTags: (_r, _e, { customerId }) => [
        { type: 'SaleReturns', id: `CUSTOMER_PRODUCTS_${customerId}` },
      ],
    }),

    // Approve sale return
    approveSaleReturn: builder.mutation({
      query: ({ returnId, notes }) => ({
        url: `sale-returns/${returnId}/approve`,
        method: 'put',
        data: { notes },
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'SaleReturns', id: returnId },
        { type: 'SaleReturns', id: 'LIST' },
        { type: 'SaleReturns', id: 'STATS' },
        { type: 'Returns', id: 'LIST' },
        { type: 'Returns', id: 'STATS' },
        { type: 'Returns', id: 'TRENDS' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Products', id: 'LIST' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),

    // Reject sale return
    rejectSaleReturn: builder.mutation({
      query: ({ returnId, reason }) => ({
        url: `sale-returns/${returnId}/reject`,
        method: 'put',
        data: { reason },
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'SaleReturns', id: returnId },
        { type: 'SaleReturns', id: 'LIST' },
        { type: 'SaleReturns', id: 'STATS' },
        { type: 'Returns', id: 'LIST' },
        { type: 'Returns', id: 'STATS' },
        { type: 'Returns', id: 'TRENDS' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Products', id: 'LIST' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),

    // Process sale return (complete with accounting)
    processSaleReturn: builder.mutation({
      query: ({ returnId, inspection }) => ({
        url: `sale-returns/${returnId}/process`,
        method: 'put',
        data: { inspection },
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'SaleReturns', id: returnId },
        { type: 'SaleReturns', id: 'LIST' },
        { type: 'SaleReturns', id: 'STATS' },
        { type: 'Returns', id: 'LIST' },
        { type: 'Returns', id: 'STATS' },
        { type: 'Returns', id: 'TRENDS' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Products', id: 'LIST' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),

    // Issue refund for deferred sale return (when refund was not paid at creation)
    issueRefund: builder.mutation({
      query: ({ returnId, amount, method = 'cash', bankId, date }) => ({
        url: `sale-returns/${returnId}/issue-refund`,
        method: 'post',
        data: { amount, method, bankId, date },
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'SaleReturns', id: returnId },
        { type: 'SaleReturns', id: 'LIST' },
        { type: 'SaleReturns', id: 'STATS' },
        { type: 'Returns', id: returnId },
        { type: 'Returns', id: 'LIST' },
        { type: 'Returns', id: 'STATS' },
        { type: 'Returns', id: 'TRENDS' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Customers', id: 'LIST' },
        { type: 'CashReceipts', id: 'LIST' },
        { type: 'BankReceipts', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),

    // Get sale return statistics
    getSaleReturnStats: builder.query({
      query: (params) => ({
        url: 'sale-returns/stats/summary',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'SaleReturns', id: 'STATS' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSaleReturnsQuery,
  useGetSaleReturnQuery,
  useCreateSaleReturnMutation,
  useGetCustomerInvoicesQuery,
  useSearchCustomerProductsQuery,
  useLazySearchCustomerProductsQuery,
  useApproveSaleReturnMutation,
  useRejectSaleReturnMutation,
  useProcessSaleReturnMutation,
  useIssueRefundMutation,
  useGetSaleReturnStatsQuery,
  useLazyGetSaleReturnQuery,
} = saleReturnsApi;
