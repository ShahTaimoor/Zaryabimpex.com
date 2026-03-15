/**
 * Bulk Operations Bar Component
 * Displays bulk action buttons and selection info
 */

import React from 'react';
import { 
  Edit, 
  Trash2, 
  Download, 
  Tag, 
  Package, 
  TrendingUp, 
  CheckSquare,
  X,
  Undo2
} from 'lucide-react';

export const BulkOperationsBar = ({
  selectedCount,
  isOperationInProgress,
  operationProgress,
  canUndo,
  onBulkUpdate,
  onBulkDelete,
  onBulkExport,
  onBulkStatusChange,
  onBulkCategoryChange,
  onBulkPriceUpdate,
  onBulkStockAdjust,
  onUndo,
  onClearSelection,
  availableActions = ['update', 'delete', 'export', 'status', 'category', 'price', 'stock'],
  className = ''
}) => {
  if (selectedCount === 0 && !isOperationInProgress) {
    return null;
  }

  return (
    <div className={`bg-primary-50 border border-primary-200 rounded-lg p-3 sm:p-4 ${className}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        {/* Selection Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
            <span className="text-xs sm:text-sm font-medium text-gray-900">
              {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
            </span>
          </div>
          
          {isOperationInProgress && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-2 border-primary-600 border-t-transparent"></div>
              <span className="text-xs sm:text-sm text-gray-600">
                {operationProgress.message || 'Processing...'} ({operationProgress.current}/{operationProgress.total})
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:items-center sm:flex-wrap gap-2 sm:gap-2 w-full sm:w-auto">
          {canUndo && (
            <button
              onClick={onUndo}
              className="btn btn-outline btn-md flex items-center justify-center gap-2"
              title="Undo last operation"
            >
              <Undo2 className="h-4 w-4" />
              <span className="hidden sm:inline">Undo</span>
              <span className="sm:hidden">Undo</span>
            </button>
          )}

          {availableActions.includes('update') && onBulkUpdate && (
            <button
              onClick={onBulkUpdate}
              disabled={isOperationInProgress}
              className="btn btn-primary btn-md flex items-center justify-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Update
            </button>
          )}

          {availableActions.includes('status') && onBulkStatusChange && (
            <button
              onClick={onBulkStatusChange}
              disabled={isOperationInProgress}
              className="btn btn-outline btn-md flex items-center justify-center gap-2"
            >
              <CheckSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Change Status</span>
              <span className="sm:hidden">Status</span>
            </button>
          )}

          {availableActions.includes('category') && onBulkCategoryChange && (
            <button
              onClick={onBulkCategoryChange}
              disabled={isOperationInProgress}
              className="btn btn-outline btn-md flex items-center justify-center gap-2"
            >
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Change Category</span>
              <span className="sm:hidden">Category</span>
            </button>
          )}

          {availableActions.includes('price') && onBulkPriceUpdate && (
            <button
              onClick={onBulkPriceUpdate}
              disabled={isOperationInProgress}
              className="btn btn-outline btn-md flex items-center justify-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Update Prices</span>
              <span className="sm:hidden">Prices</span>
            </button>
          )}

          {availableActions.includes('stock') && onBulkStockAdjust && (
            <button
              onClick={onBulkStockAdjust}
              disabled={isOperationInProgress}
              className="btn btn-outline btn-md flex items-center justify-center gap-2"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Adjust Stock</span>
              <span className="sm:hidden">Stock</span>
            </button>
          )}

          {availableActions.includes('export') && onBulkExport && (
            <button
              onClick={onBulkExport}
              disabled={isOperationInProgress}
              className="btn btn-outline btn-md flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )}

          {availableActions.includes('delete') && onBulkDelete && (
            <button
              onClick={onBulkDelete}
              disabled={isOperationInProgress}
              className="btn btn-outline btn-md flex items-center justify-center gap-2 border-red-300 text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}

          <button
            onClick={onClearSelection}
            disabled={isOperationInProgress}
            className="btn btn-outline btn-md flex items-center justify-center gap-2 col-span-2 sm:col-span-1"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isOperationInProgress && operationProgress.total > 0 && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(operationProgress.current / operationProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkOperationsBar;

