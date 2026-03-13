import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/`
  : 'http://localhost:5000/api/';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery({ baseUrl: BASE_URL }),
  tagTypes: [
    'Auth',
    'Sales',
    'Accounting',
    'Products',
    'Customers',
    'Suppliers',
    'Categories',
    'Cities',
    'Orders',
    'Inventory',
    'Settings',
    'Reports',
    'Health',
    'ChartOfAccounts',
    'PurchaseOrders',
    'PurchaseInvoices',
    'SalesOrders',
    'BankReceipts',
    'BankPayments',
    'Banks',
    'CashReceipts',
    'CashPayments',
    'Warehouses',
    'RecurringExpenses',
    'Returns',
    'SaleReturns',
    'Discounts',
    'JournalVouchers',
    'Users',
    'Payments',
    'Recommendations',
    'Company',
  ],
  endpoints: (builder) => ({
    health: builder.query({
      query: () => ({ url: 'health', method: 'get' }),
      providesTags: ['Health'],
    }),
  }),
});

export const { useHealthQuery } = api;

