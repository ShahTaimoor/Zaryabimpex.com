import { api } from '../api';

export const employeesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getEmployees: builder.query({
      query: (params) => {
        // Filter out empty string parameters
        const filteredParams = {};
        Object.keys(params).forEach(key => {
          const value = params[key];
          // Only include non-empty values (skip empty strings, null, undefined)
          if (value !== '' && value !== null && value !== undefined) {
            filteredParams[key] = value;
          }
        });
        return {
          url: 'employees',
          method: 'get',
          params: filteredParams,
        };
      },
      providesTags: (result) => {
        const list = result?.data?.employees || result?.employees || result?.items || [];
        return list.length
          ? [
            ...list.map(({ _id, id }) => ({ type: 'Users', id: _id || id })),
            { type: 'Users', id: 'EMPLOYEES_LIST' },
          ]
          : [{ type: 'Users', id: 'EMPLOYEES_LIST' }];
      },
    }),
    getEmployee: builder.query({
      query: (id) => ({
        url: `employees/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Users', id }],
    }),
    createEmployee: builder.mutation({
      query: (data) => ({
        url: 'employees',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Users', id: 'EMPLOYEES_LIST' }],
    }),
    updateEmployee: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `employees/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Users', id },
        { type: 'Users', id: 'EMPLOYEES_LIST' },
      ],
    }),
    deleteEmployee: builder.mutation({
      query: (id) => ({
        url: `employees/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Users', id },
        { type: 'Users', id: 'EMPLOYEES_LIST' },
      ],
    }),
    getDepartments: builder.query({
      query: () => ({
        url: 'employees/departments/list',
        method: 'get',
      }),
      providesTags: [{ type: 'Settings', id: 'DEPARTMENTS' }],
    }),
    getPositions: builder.query({
      query: () => ({
        url: 'employees/positions/list',
        method: 'get',
      }),
      providesTags: [{ type: 'Settings', id: 'POSITIONS' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEmployeesQuery,
  useLazyGetEmployeesQuery,
  useGetEmployeeQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  useGetDepartmentsQuery,
  useGetPositionsQuery,
} = employeesApi;

