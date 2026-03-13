import { api } from '../api';

export const reportsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSalesReport: builder.query({
      query: (params) => ({
        url: 'reports/sales',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'SALES_REPORT' }],
    }),
    getProductReport: builder.query({
      query: (params) => ({
        url: 'reports/products',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'PRODUCT_REPORT' }],
    }),
    getCustomerReport: builder.query({
      query: (params) => ({
        url: 'reports/customers',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'CUSTOMER_REPORT' }],
    }),
    getInventoryReport: builder.query({
      query: (params) => ({
        url: 'reports/inventory',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'INVENTORY_REPORT' }],
    }),
    getSummaryCards: builder.query({
      query: (params) => ({
        url: 'reports/summary-cards',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'SUMMARY_CARDS' }],
    }),
    getPartyBalanceReport: builder.query({
      query: (params) => ({
        url: 'reports/party-balance',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'PARTY_BALANCE' }],
    }),
    getFinancialReport: builder.query({
      query: (params) => ({
        url: 'reports/financial',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'FINANCIAL_REPORT' }],
    }),
    getBankCashSummary: builder.query({
      query: (params) => ({
        url: 'reports/bank-cash-summary',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'BANK_CASH_SUMMARY' }],
    }),
    getBackdateReport: builder.query({
      query: () => ({
        url: 'backdate-report',
        method: 'get',
      }),
      providesTags: [{ type: 'Reports', id: 'BACKDATE_REPORT' }],
    }),
    getPurchaseBySupplierReport: builder.query({
      query: (params) => ({
        url: 'reports/purchase-by-supplier',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSalesReportQuery,
  useGetProductReportQuery,
  useGetCustomerReportQuery,
  useGetInventoryReportQuery,
  useGetSummaryCardsQuery,
  useGetPartyBalanceReportQuery,
  useGetFinancialReportQuery,
  useGetBankCashSummaryQuery,
  useGetBackdateReportQuery,
  useGetPurchaseBySupplierReportQuery,
} = reportsApi;

