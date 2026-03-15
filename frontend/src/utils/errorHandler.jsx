import React from 'react';
import toast from 'react-hot-toast';

// Error types and their corresponding user messages
const ERROR_MESSAGES = {
  network: 'Unable to connect to server. Please check your internet connection.',
  server: 'Server error. Please try again later.',
  validation: 'Please check your input and try again.',
  not_found: 'The requested resource was not found.',
  forbidden: 'You do not have permission to perform this action.',
  timeout: 'Request timed out. Please try again.',
  unknown: 'An unexpected error occurred. Please try again.'
};

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Get user-friendly error message
export const getErrorMessage = (error) => {
  // Safety check for null/undefined
  if (!error) {
    return ERROR_MESSAGES.unknown;
  }
  
  // RTK Query error format: error.data.message (from axiosBaseQuery)
  if (error?.data?.message) {
    const message = error.data.message;
    if (typeof message === 'string') {
      return message;
    } else if (typeof message === 'object') {
      return JSON.stringify(message);
    }
    return String(message);
  }
  
  // If error has a specific message, use it first (most specific)
  if (error?.message) {
    const message = error.message;
    if (typeof message === 'string') {
      return message;
    } else if (typeof message === 'object') {
      return JSON.stringify(message);
    }
    return String(message);
  }
  
  // If error has response data with message, use it (for axios errors)
  if (error?.response?.data?.message) {
    const message = error.response.data.message;
    if (typeof message === 'string') {
      return message;
    } else if (typeof message === 'object') {
      return JSON.stringify(message);
    }
    return String(message);
  }
  
  // If error has a type, use predefined message (fallback)
  if (error?.type && ERROR_MESSAGES[error.type]) {
    return ERROR_MESSAGES[error.type];
  }
  
  // If error is a string, return it
  if (typeof error === 'string') {
    return error;
  }
  
  // If error is an object, try to stringify it safely
  if (typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch (e) {
      return ERROR_MESSAGES.unknown;
    }
  }
  
  // Default fallback
  return ERROR_MESSAGES.unknown;
};

// Get error severity based on error type
export const getErrorSeverity = (error) => {
  if (error?.type) {
    switch (error.type) {
      case 'network':
      case 'timeout':
        return ERROR_SEVERITY.HIGH;
      case 'server':
        return ERROR_SEVERITY.CRITICAL;
      case 'validation':
        return ERROR_SEVERITY.LOW;
      case 'not_found':
      case 'forbidden':
        return ERROR_SEVERITY.MEDIUM;
      default:
        return ERROR_SEVERITY.MEDIUM;
    }
  }
  
  // Check HTTP status codes (RTK Query format: error.status)
  if (error?.status) {
    const status = error.status;
    if (status >= 500) return ERROR_SEVERITY.CRITICAL;
    if (status >= 400) return ERROR_SEVERITY.MEDIUM;
    return ERROR_SEVERITY.LOW;
  }
  
  // Check HTTP status codes (axios format: error.response.status)
  if (error?.response?.status) {
    const status = error.response.status;
    if (status >= 500) return ERROR_SEVERITY.CRITICAL;
    if (status >= 400) return ERROR_SEVERITY.MEDIUM;
    return ERROR_SEVERITY.LOW;
  }
  
  return ERROR_SEVERITY.MEDIUM;
};

// Show error toast with appropriate styling
export const showErrorToast = (error, options = {}) => {
  try {
    const message = getErrorMessage(error);
    const severity = getErrorSeverity(error);
    
    // Ensure message is a string
    const safeMessage = typeof message === 'string' ? message : String(message);
    
    const toastOptions = {
      duration: severity === ERROR_SEVERITY.CRITICAL ? 8000 : 4000,
      ...options
    };
    
    return toast.error(safeMessage, toastOptions);
  } catch (e) {
    // Fallback if everything fails
    return toast.error('An unexpected error occurred');
  }
};

// Show success toast
export const showSuccessToast = (message, options = {}) => {
  try {
    const safeMessage = typeof message === 'string' ? message : String(message);
    return toast.success(safeMessage, {
      duration: 3000,
      ...options
    });
  } catch (e) {
    return toast.success('Success');
  }
};

// Show warning toast
export const showWarningToast = (message, options = {}) => {
  try {
    const safeMessage = typeof message === 'string' ? message : String(message);
    return toast(safeMessage, {
      icon: '⚠️',
      duration: 4000,
      ...options
    });
  } catch (e) {
    return toast('Warning', {
      icon: '⚠️',
      duration: 4000
    });
  }
};

// Show info toast
export const showInfoToast = (message, options = {}) => {
  try {
    const safeMessage = typeof message === 'string' ? message : String(message);
    return toast(safeMessage, {
      icon: 'ℹ️',
      duration: 3000,
      ...options
    });
  } catch (e) {
    return toast('Info', {
      icon: 'ℹ️',
      duration: 3000
    });
  }
};

// Handle API errors with appropriate user feedback
export const handleApiError = (error, context = '') => {
  try {
    const message = getErrorMessage(error);
    const severity = getErrorSeverity(error);
    
    // Ensure message is a string
    const safeMessage = typeof message === 'string' ? message : String(message);
    
    // Show appropriate toast
    showErrorToast(error);
    
    // Return error info for further handling
    return {
      message: safeMessage,
      severity,
      type: error?.type,
      status: error?.status || error?.response?.status,
      originalError: error
    };
  } catch (e) {
    // Fallback if everything fails
    showErrorToast({ message: 'An unexpected error occurred' });
    return {
      message: 'An unexpected error occurred',
      severity: ERROR_SEVERITY.HIGH,
      type: 'unknown',
      status: null,
      originalError: error
    };
  }
};

// Retry mechanism for failed requests
export const withRetry = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry for certain error types
      if (error?.type === 'validation' || error?.type === 'forbidden') {
        throw error;
      }
      
      // Wait before retrying
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
};

// Safe async wrapper that catches and handles errors
export const safeAsync = async (asyncFn, fallback = null, context = '') => {
  try {
    return await asyncFn();
  } catch (error) {
    const errorInfo = handleApiError(error, context);
    return fallback || errorInfo;
  }
};

// Error boundary helper for React components
export const createErrorBoundary = (Component, fallback = null) => {
  return class extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }
    
    componentDidCatch(error, errorInfo) {
      handleApiError(error, 'Error Boundary');
    }
    
    render() {
      if (this.state.hasError) {
        return fallback || (
          <div className="text-center py-8">
            <p className="text-red-600">Something went wrong. Please refresh the page.</p>
          </div>
        );
      }
      
      return <Component {...this.props} />;
    }
  };
};

export default {
  getErrorMessage,
  getErrorSeverity,
  showErrorToast,
  showSuccessToast,
  showWarningToast,
  showInfoToast,
  handleApiError,
  withRetry,
  safeAsync,
  createErrorBoundary,
  ERROR_SEVERITY
};