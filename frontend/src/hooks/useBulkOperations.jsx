/**
 * Bulk Operations Hook
 * Manages selection, bulk operations, progress, and undo functionality
 */

import { useState, useCallback, useRef } from 'react';

export const useBulkOperations = (items = [], options = {}) => {
  const {
    idField = '_id',
    onBulkOperation = null,
    enableUndo = true,
    maxUndoHistory = 10
  } = options;

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);
  const [operationProgress, setOperationProgress] = useState({ current: 0, total: 0, message: '' });
  const [undoHistory, setUndoHistory] = useState([]);
  const [lastOperation, setLastOperation] = useState(null);
  
  const operationHistoryRef = useRef([]);

  // Toggle selection for a single item
  const toggleSelection = useCallback((id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      setIsSelectAll(newSet.size === items.length && items.length > 0);
      return newSet;
    });
  }, [items]);

  // Select all items (respects current filters)
  const selectAll = useCallback((filteredItems = null) => {
    const itemsToSelect = filteredItems || items;
    const allIds = new Set(itemsToSelect.map(item => item[idField]));
    setSelectedIds(allIds);
    setIsSelectAll(true);
  }, [items, idField]);

  // Deselect all
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectAll(false);
  }, []);

  // Toggle select all
  const toggleSelectAll = useCallback((filteredItems = null) => {
    const itemsToSelect = filteredItems || items;
    if (isSelectAll) {
      deselectAll();
    } else {
      selectAll(itemsToSelect);
    }
  }, [isSelectAll, items, selectAll, deselectAll]);

  // Get selected items
  const getSelectedItems = useCallback(() => {
    return items.filter(item => selectedIds.has(item[idField]));
  }, [items, selectedIds, idField]);

  // Check if item is selected
  const isSelected = useCallback((id) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  // Get selected count
  const selectedCount = selectedIds.size;

  // Execute bulk operation with progress tracking
  const executeBulkOperation = useCallback(async (operation, operationData = {}) => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
      return { success: false, message: 'No items selected' };
    }

    setIsOperationInProgress(true);
    setOperationProgress({ current: 0, total: selectedItems.length, message: 'Starting operation...' });

    // Save state for undo
    const previousState = selectedItems.map(item => ({ ...item }));
    const operationRecord = {
      id: Date.now().toString(),
      type: operation,
      timestamp: new Date().toISOString(),
      items: previousState,
      data: operationData
    };

    try {
      let successCount = 0;
      let failureCount = 0;
      const errors = [];

      // Process items one by one with progress updates
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        setOperationProgress({
          current: i + 1,
          total: selectedItems.length,
          message: `Processing ${item.name || item.orderNumber || item.businessName || 'item'}...`
        });

        try {
          if (onBulkOperation) {
            await onBulkOperation(item, operation, operationData);
          }
          successCount++;
        } catch (error) {
          failureCount++;
          errors.push({ item, error: error.message || 'Unknown error' });
        }

        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Save to undo history
      if (enableUndo) {
        setUndoHistory(prev => {
          const updated = [operationRecord, ...prev].slice(0, maxUndoHistory);
          operationHistoryRef.current = updated;
          return updated;
        });
        setLastOperation(operationRecord);
      }

      // Clear selection after successful operation
      if (successCount > 0) {
        deselectAll();
      }

      setIsOperationInProgress(false);
      setOperationProgress({ current: 0, total: 0, message: '' });

      return {
        success: true,
        successCount,
        failureCount,
        errors,
        operationRecord
      };
    } catch (error) {
      setIsOperationInProgress(false);
      setOperationProgress({ current: 0, total: 0, message: '' });
      return {
        success: false,
        message: error.message || 'Operation failed',
        operationRecord
      };
    }
  }, [getSelectedItems, onBulkOperation, enableUndo, maxUndoHistory, deselectAll]);

  // Undo last operation
  const undoLastOperation = useCallback(async () => {
    if (undoHistory.length === 0 || !lastOperation) {
      return { success: false, message: 'No operation to undo' };
    }

    setIsOperationInProgress(true);
    setOperationProgress({
      current: 0,
      total: lastOperation.items.length,
      message: 'Undoing operation...'
    });

    try {
      // Reverse the operation
      for (let i = 0; i < lastOperation.items.length; i++) {
        const item = lastOperation.items[i];
        setOperationProgress({
          current: i + 1,
          total: lastOperation.items.length,
          message: `Reverting ${item.name || item.orderNumber || item.businessName || 'item'}...`
        });

        if (onBulkOperation) {
          await onBulkOperation(item, `undo_${lastOperation.type}`, lastOperation.data);
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Remove from undo history
      setUndoHistory(prev => prev.filter(op => op.id !== lastOperation.id));
      setLastOperation(undoHistory[1] || null);

      setIsOperationInProgress(false);
      setOperationProgress({ current: 0, total: 0, message: '' });

      return { success: true, message: 'Operation undone successfully' };
    } catch (error) {
      setIsOperationInProgress(false);
      setOperationProgress({ current: 0, total: 0, message: '' });
      return { success: false, message: error.message || 'Undo failed' };
    }
  }, [undoHistory, lastOperation, onBulkOperation]);

  // Clear undo history
  const clearUndoHistory = useCallback(() => {
    setUndoHistory([]);
    setLastOperation(null);
    operationHistoryRef.current = [];
  }, []);

  return {
    // Selection state
    selectedIds: Array.from(selectedIds),
    selectedCount,
    isSelectAll,
    isSelected,
    getSelectedItems,

    // Selection actions
    toggleSelection,
    selectAll,
    deselectAll,
    toggleSelectAll,

    // Operation state
    isOperationInProgress,
    operationProgress,
    canUndo: enableUndo && lastOperation !== null,
    undoHistory,

    // Operations
    executeBulkOperation,
    undoLastOperation,
    clearUndoHistory
  };
};

export default useBulkOperations;

