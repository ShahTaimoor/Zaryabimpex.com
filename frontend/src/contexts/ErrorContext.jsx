import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { handleApiError, ERROR_SEVERITY } from '../utils/errorHandler';
import toast from 'react-hot-toast';

// Error context
const ErrorContext = createContext();

// Error reducer
const errorReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.context]: action.error
        }
      };
    case 'REMOVE_ERROR':
      const newErrors = { ...state.errors };
      delete newErrors[action.context];
      return {
        ...state,
        errors: newErrors
      };
    case 'CLEAR_ALL_ERRORS':
      return {
        ...state,
        errors: {}
      };
    case 'SET_GLOBAL_ERROR':
      return {
        ...state,
        globalError: action.error
      };
    case 'CLEAR_GLOBAL_ERROR':
      return {
        ...state,
        globalError: null
      };
    default:
      return state;
  }
};

// Error provider component
export const ErrorProvider = ({ children }) => {
  const [state, dispatch] = useReducer(errorReducer, {
    errors: {},
    globalError: null
  });

  const handleError = useCallback((error, context = 'global') => {
    const errorInfo = handleApiError(error, context);
    
    dispatch({
      type: 'ADD_ERROR',
      context,
      error: errorInfo
    });

    // Show toast notification
    if (errorInfo.severity === ERROR_SEVERITY.CRITICAL) {
      toast.error('Backend server error. Please ensure the server is running.');
    } else if (errorInfo.severity === ERROR_SEVERITY.HIGH) {
      toast.error('Please log in to continue.');
    } else if (errorInfo.severity === ERROR_SEVERITY.MEDIUM) {
      toast.error('You do not have permission to perform this action.');
    } else {
      toast.error(errorInfo.message);
    }

    return errorInfo;
  }, []);

  const clearError = useCallback((context) => {
    dispatch({
      type: 'REMOVE_ERROR',
      context
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    dispatch({
      type: 'CLEAR_ALL_ERRORS'
    });
  }, []);

  const setGlobalError = useCallback((error) => {
    dispatch({
      type: 'SET_GLOBAL_ERROR',
      error
    });
  }, []);

  const clearGlobalError = useCallback(() => {
    dispatch({
      type: 'CLEAR_GLOBAL_ERROR'
    });
  }, []);

  const getError = useCallback((context) => {
    return state.errors[context] || null;
  }, [state.errors]);

  const hasError = useCallback((context) => {
    return !!state.errors[context];
  }, [state.errors]);

  const value = {
    errors: state.errors,
    globalError: state.globalError,
    handleError,
    clearError,
    clearAllErrors,
    setGlobalError,
    clearGlobalError,
    getError,
    hasError
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};

// Hook to use error context
export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

export default ErrorContext;
