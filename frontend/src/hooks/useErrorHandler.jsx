import { useState, useCallback } from 'react';
import { handleError, reportError } from '../utils/errorHandler';
import toast from 'react-hot-toast';

export const useErrorHandler = () => {
  const [errors, setErrors] = useState({});

  const handleError = useCallback((error, context = '') => {
    const errorInfo = reportError(error, context);
    
    // Store error in state
    setErrors(prev => ({
      ...prev,
      [context]: errorInfo
    }));

    // Show user-friendly message
    toast.error(errorInfo.message);

    return errorInfo;
  }, []);

  const clearError = useCallback((context) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[context];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const getError = useCallback((context) => {
    return errors[context] || null;
  }, [errors]);

  const hasError = useCallback((context) => {
    return !!errors[context];
  }, [errors]);

  return {
    handleError,
    clearError,
    clearAllErrors,
    getError,
    hasError,
    errors
  };
};

export default useErrorHandler;
