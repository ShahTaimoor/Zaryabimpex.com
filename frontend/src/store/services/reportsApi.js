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
    getBackdateReport: builder.query({
      query: () => ({
        url: 'backdate-report',
        method: 'get',
      }),
      providesTags: [{ type: 'Reports', id: 'BACKDATE_REPORT' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSalesReportQuery,
  useGetProductReportQuery,
  useGetCustomerReportQuery,
  useGetInventoryReportQuery,
  useGetBackdateReportQuery,
} = reportsApi;

