import axios from 'axios';
import { sanitizeRequestData, sanitizeResponseData } from '../utils/sanitization';

const getRequestIdFromResponse = (response) => {
  if (!response) return null;
  return (
    response?.data?.requestId ||
    response?.data?.error?.requestId ||
    response?.headers?.['x-request-id'] ||
    response?.headers?.['X-Request-ID'] ||
    null
  );
};

// Shared refresh state to prevent concurrent refresh calls
let refreshPromise = null;

/**
 * Creates an axios-based base query for RTK Query
 * @param {Object} options - Configuration options
 * @param {string} options.baseUrl - Base URL for API requests
 * @returns {Function} RTK Query base query function
 */
const axiosBaseQuery = ({ baseUrl = '' } = {}) => {
  const axiosInstance = axios.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  });

  // Request interceptor
  axiosInstance.interceptors.request.use(
    (config) => {
      if (typeof window !== 'undefined') {
        try {
          const storedToken = localStorage.getItem('authToken');
          if (storedToken) {
            config.headers = config.headers ? { ...config.headers } : {};
            config.headers.Authorization = `Bearer ${storedToken}`;
          }
        } catch {
          // ignore storage errors
        }
      }

      if (config.url && config.url.startsWith('/')) {
        config.url = config.url.substring(1);
      }

      if (config.data instanceof FormData) {
        config.headers = config.headers ? { ...config.headers } : {};
        delete config.headers['Content-Type'];
      } else if (config.data) {
        config.data = sanitizeRequestData(config.data);
      }

      if (config.params) {
        config.params = sanitizeRequestData(config.params);
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor
  axiosInstance.interceptors.response.use(
    (response) => {
      if (response.data && !(response.data instanceof Blob) && !(response.data instanceof ArrayBuffer)) {
        response.data = sanitizeResponseData(response.data);
      }
      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      // On 401, try a silent token refresh (skip for auth endpoints to avoid loops)
      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url?.includes('auth/refresh') &&
        !originalRequest.url?.includes('auth/login')
      ) {
        originalRequest._retry = true;

        try {
          // Coalesce concurrent refresh attempts into a single request
          if (!refreshPromise) {
            refreshPromise = axiosInstance.post('auth/refresh').finally(() => {
              refreshPromise = null;
            });
          }
          const refreshResponse = await refreshPromise;

          // Store new token for Safari/iPad fallback
          const newToken = refreshResponse?.data?.token;
          if (newToken && typeof window !== 'undefined') {
            try {
              localStorage.setItem('authToken', newToken);
              const userData = refreshResponse?.data?.user;
              if (userData) {
                localStorage.setItem('authUser', JSON.stringify(userData));
              }
            } catch {
              // ignore storage errors
            }
          }

          // Update the Authorization header and retry the original request
          if (newToken) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return axiosInstance(originalRequest);
        } catch {
          // Refresh failed — token is truly invalid, let 401 propagate
          return Promise.reject(error);
        }
      }

      if (!error.response) {
        return Promise.reject({
          ...error,
          message: 'Server is currently under maintenance. Please try again shortly.',
          type: 'network',
        });
      }

      return Promise.reject(error);
    }
  );

  // Return RTK Query base query function
  return async ({ url, method = 'GET', data, params, headers, responseType, responseHandler, ...rest }) => {
    try {
      const config = {
        url,
        method,
        data,
        params,
        headers,
        ...rest,
      };

      if (responseType === 'blob' || responseHandler) {
        config.responseType = 'blob';
      }

      const result = await axiosInstance(config);

      if (responseHandler && typeof responseHandler === 'function') {
        const processedData = await responseHandler(result);
        return {
          data: processedData,
          meta: {
            response: {
              headers: result.headers,
              status: result.status,
            },
          },
        };
      }

      if (config.responseType === 'blob') {
        return {
          data: result.data,
          meta: {
            response: {
              headers: result.headers,
              status: result.status,
            },
          },
        };
      }

      return {
        data: result.data,
      };
    } catch (axiosError) {
      const err = axiosError;
      const requestId = getRequestIdFromResponse(err.response);
      const errorPayload = err.response?.data || err.message;

      return {
        error: {
          status: err.response?.status,
          data: errorPayload,
          requestId,
        },
      };
    }
  };
};

export default axiosBaseQuery;
