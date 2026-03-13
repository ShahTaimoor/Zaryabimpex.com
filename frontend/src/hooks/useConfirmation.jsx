import { useState, useCallback } from 'react';

export const useConfirmation = () => {
  const [confirmation, setConfirmation] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'warning',
    onConfirm: null,
    onCancel: null,
    isLoading: false
  });

  const showConfirmation = useCallback((options) => {
    setConfirmation({
      isOpen: true,
      title: options.title || 'Confirm Action',
      message: options.message || 'Are you sure you want to proceed?',
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      type: options.type || 'warning',
      onConfirm: options.onConfirm || (() => {}),
      onCancel: options.onCancel || (() => {}),
      isLoading: false
    });
  }, []);

  const hideConfirmation = useCallback(() => {
    setConfirmation(prev => ({
      ...prev,
      isOpen: false,
      isLoading: false
    }));
  }, []);

  const setLoading = useCallback((isLoading) => {
    setConfirmation(prev => ({
      ...prev,
      isLoading
    }));
  }, []);

  const handleConfirm = useCallback(async () => {
    try {
      setLoading(true);
      await confirmation.onConfirm();
      hideConfirmation();
    } catch (error) {
      // Confirmation action failed - error handled by caller
      setLoading(false);
    }
  }, [confirmation.onConfirm, hideConfirmation, setLoading]);

  const handleCancel = useCallback(() => {
    if (confirmation.onCancel) {
      confirmation.onCancel();
    }
    hideConfirmation();
  }, [confirmation.onCancel, hideConfirmation]);

  return {
    confirmation,
    showConfirmation,
    hideConfirmation,
    setLoading,
    handleConfirm,
    handleCancel
  };
};

// Specialized hooks for common confirmation types
export const useDeleteConfirmation = () => {
  const { showConfirmation, ...rest } = useConfirmation();

  const confirmDelete = useCallback((itemName, itemType, onConfirm) => {
    showConfirmation({
      title: `Delete ${itemType}`,
      message: `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
      onConfirm
    });
  }, [showConfirmation]);

  return {
    ...rest,
    confirmDelete
  };
};

export const useCancelConfirmation = () => {
  const { showConfirmation, ...rest } = useConfirmation();

  const confirmCancel = useCallback((itemName, itemType, onConfirm) => {
    showConfirmation({
      title: `Cancel ${itemType}`,
      message: `Are you sure you want to cancel "${itemName}"? This action cannot be undone.`,
      confirmText: 'Cancel Order',
      type: 'warning',
      onConfirm
    });
  }, [showConfirmation]);

  return {
    ...rest,
    confirmCancel
  };
};

export const useClearConfirmation = () => {
  const { showConfirmation, ...rest } = useConfirmation();

  const confirmClear = useCallback((itemCount, itemType, onConfirm) => {
    showConfirmation({
      title: 'Clear All Items',
      message: `Are you sure you want to clear all ${itemCount} ${itemType}? This action cannot be undone.`,
      confirmText: 'Clear All',
      type: 'warning',
      onConfirm
    });
  }, [showConfirmation]);

  return {
    ...rest,
    confirmClear
  };
};

export const useBulkDeleteConfirmation = () => {
  const { showConfirmation, ...rest } = useConfirmation();

  const confirmBulkDelete = useCallback((itemCount, itemType, onConfirm) => {
    showConfirmation({
      title: 'Bulk Delete',
      message: `Are you sure you want to delete ${itemCount} ${itemType}? This action cannot be undone.`,
      confirmText: `Delete ${itemCount} Items`,
      type: 'danger',
      onConfirm
    });
  }, [showConfirmation]);

  return {
    ...rest,
    confirmBulkDelete
  };
};

export default useConfirmation;
