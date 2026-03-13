import React, { useState, useCallback } from 'react';

// Loading state types
export const LOADING_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
};

// Custom hook for managing loading states
export const useLoadingState = (initialState = LOADING_STATES.IDLE) => {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const setLoading = useCallback(() => {
    setState(LOADING_STATES.LOADING);
    setError(null);
  }, []);

  const setSuccess = useCallback((successData = null) => {
    setState(LOADING_STATES.SUCCESS);
    setError(null);
    if (successData !== null) {
      setData(successData);
    }
  }, []);

  const setErrorState = useCallback((errorData) => {
    setState(LOADING_STATES.ERROR);
    setError(errorData);
  }, []);

  const reset = useCallback(() => {
    setState(LOADING_STATES.IDLE);
    setError(null);
    setData(null);
  }, []);

  return {
    state,
    error,
    data,
    isLoading: state === LOADING_STATES.LOADING,
    isSuccess: state === LOADING_STATES.SUCCESS,
    isError: state === LOADING_STATES.ERROR,
    isIdle: state === LOADING_STATES.IDLE,
    setLoading,
    setSuccess,
    setError: setErrorState,
    reset
  };
};

// Enhanced loading state with retry capability
export const useAsyncState = (asyncFn, options = {}) => {
  const {
    immediate = false,
    retryCount = 0,
    retryDelay = 1000,
    onSuccess = null,
    onError = null
  } = options;

  const loadingState = useLoadingState();
  const [retryAttempts, setRetryAttempts] = useState(0);

  const execute = useCallback(async (...args) => {
    loadingState.setLoading();
    
    try {
      const result = await asyncFn(...args);
      loadingState.setSuccess(result);
      onSuccess?.(result);
      setRetryAttempts(0);
      return result;
    } catch (error) {
      loadingState.setError(error);
      onError?.(error);
      throw error;
    }
  }, [asyncFn, onSuccess, onError, loadingState]);

  const retry = useCallback(async (...args) => {
    if (retryAttempts < retryCount) {
      setRetryAttempts(prev => prev + 1);
      setTimeout(() => execute(...args), retryDelay);
    }
  }, [execute, retryAttempts, retryCount, retryDelay]);

  const reset = useCallback(() => {
    loadingState.reset();
    setRetryAttempts(0);
  }, [loadingState]);

  // Execute immediately if requested
  React.useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return {
    ...loadingState,
    execute,
    retry,
    reset,
    retryAttempts,
    canRetry: retryAttempts < retryCount
  };
};

// Loading state for multiple operations
export const useMultiLoadingState = (operationKeys = []) => {
  const [states, setStates] = useState(() => 
    operationKeys.reduce((acc, key) => {
      acc[key] = {
        state: LOADING_STATES.IDLE,
        error: null,
        data: null
      };
      return acc;
    }, {})
  );

  const setLoading = useCallback((key) => {
    setStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        state: LOADING_STATES.LOADING,
        error: null
      }
    }));
  }, []);

  const setSuccess = useCallback((key, data = null) => {
    setStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        state: LOADING_STATES.SUCCESS,
        error: null,
        data
      }
    }));
  }, []);

  const setError = useCallback((key, error) => {
    setStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        state: LOADING_STATES.ERROR,
        error
      }
    }));
  }, []);

  const reset = useCallback((key) => {
    setStates(prev => ({
      ...prev,
      [key]: {
        state: LOADING_STATES.IDLE,
        error: null,
        data: null
      }
    }));
  }, []);

  const resetAll = useCallback(() => {
    setStates(prev => 
      Object.keys(prev).reduce((acc, key) => {
        acc[key] = {
          state: LOADING_STATES.IDLE,
          error: null,
          data: null
        };
        return acc;
      }, {})
    );
  }, []);

  const getState = useCallback((key) => {
    return states[key] || {
      state: LOADING_STATES.IDLE,
      error: null,
      data: null
    };
  }, [states]);

  const isLoading = useCallback((key) => {
    return getState(key).state === LOADING_STATES.LOADING;
  }, [getState]);

  const isSuccess = useCallback((key) => {
    return getState(key).state === LOADING_STATES.SUCCESS;
  }, [getState]);

  const isError = useCallback((key) => {
    return getState(key).state === LOADING_STATES.ERROR;
  }, [getState]);

  const hasAnyLoading = useCallback(() => {
    return Object.values(states).some(state => state.state === LOADING_STATES.LOADING);
  }, [states]);

  const hasAnyError = useCallback(() => {
    return Object.values(states).some(state => state.state === LOADING_STATES.ERROR);
  }, [states]);

  return {
    states,
    setLoading,
    setSuccess,
    setError,
    reset,
    resetAll,
    getState,
    isLoading,
    isSuccess,
    isError,
    hasAnyLoading,
    hasAnyError
  };
};

// Loading state for form submissions
export const useFormLoadingState = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const startSubmit = useCallback(() => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, []);

  const endSubmit = useCallback((success = true, error = null) => {
    setIsSubmitting(false);
    if (success) {
      setSubmitSuccess(true);
      setSubmitError(null);
    } else {
      setSubmitError(error);
      setSubmitSuccess(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, []);

  return {
    isSubmitting,
    submitError,
    submitSuccess,
    startSubmit,
    endSubmit,
    reset
  };
};

export default {
  LOADING_STATES,
  useLoadingState,
  useAsyncState,
  useMultiLoadingState,
  useFormLoadingState
};
