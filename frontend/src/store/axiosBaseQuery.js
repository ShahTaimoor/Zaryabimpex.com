import axios from 'axios';
import { sanitizeRequestData, sanitizeResponseData } from '../utils/sanitization';

/**
 * Creates an axios-based base query for RTK Query
 * @param {Object} options - Configuration options
 * @param {string} options.baseUrl - Base URL for API requests
 * @returns {Function} RTK Query base query function
 */
const axiosBaseQuery = ({ baseUrl = '' } = {}) => {
  // Create axios instance
  const axiosInstance = axios.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true, // Enable sending cookies (HTTP-only cookies for auth)
  });

  // Request interceptor to add idempotency key and sanitize data
  // Note: Auth token is handled via HTTP-only cookies (sent automatically with withCredentials: true)
  axiosInstance.interceptors.request.use(
    (config) => {
      // Token is in HTTP-only cookie, sent automatically by browser
      // No need to read from localStorage

      // Don't generate idempotency keys automatically - let the backend handle duplicate detection
      // The frontend guard (isSubmittingRef/isSubmitting) prevents duplicate clicks
      // Backend duplicate prevention middleware can be disabled or kept as a safety net

      // Ensure relative URLs combine with baseURL
      if (config.url && config.url.startsWith('/')) {
        config.url = config.url.substring(1);
      }

      // FormData: do not sanitize and let axios set Content-Type (multipart/form-data)
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

  // Response interceptor to handle errors and sanitize responses
  axiosInstance.interceptors.response.use(
    (response) => {
      // Skip sanitization for blob responses (files, PDFs, images, etc.)
      if (response.data && !(response.data instanceof Blob) && !(response.data instanceof ArrayBuffer)) {
        response.data = sanitizeResponseData(response.data);
      }
      return response;
    },
    (error) => {
      // Handle authentication errors
      if (error.response?.status === 401) {
        // Token is in HTTP-only cookie, backend should clear it on logout
        // Just redirect to login
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // Handle network errors
      if (!error.response) {
        return Promise.reject({
          ...error,
          message: `Unable to connect to server at ${error.config?.baseURL || baseUrl}. Please ensure the backend server is running.`,
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

      // Handle blob response type
      if (responseType === 'blob' || responseHandler) {
        config.responseType = 'blob';
      }

      const result = await axiosInstance(config);

      // If responseHandler is provided, use it to process the response
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

      // For blob responses, include headers in meta for filename extraction
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
      return {
        error: {
          status: err.response?.status,
          data: err.response?.data || err.message,
        },
      };
    }
  };
};

export default axiosBaseQuery;
