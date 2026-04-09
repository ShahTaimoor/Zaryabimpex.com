/**
 * Bulk Operations Bar Component
 * Displays bulk action buttons and selection info
 */

import React from 'react';
import { 
  Edit, 
  Trash2, 
  Tag, 
  Package, 
  TrendingUp, 
  CheckSquare,
  X,
  Undo2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const BulkOperationsBar = ({
  selectedCount,
  isOperationInProgress,
  operationProgress,
  canUndo,
  onBulkUpdate,
  onBulkDelete,
  onBulkStatusChange,
  onBulkCategoryChange,
  onBulkPriceUpdate,
  onBulkStockAdjust,
  onUndo,
  onClearSelection,
  availableActions = ['update', 'delete', 'status', 'category', 'price', 'stock'],
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
            <Button
              onClick={onUndo}
              variant="outline"
              size="default"
              className="flex items-center justify-center gap-2"
              title="Undo last operation"
            >
              <Undo2 className="h-4 w-4" />
              <span className="hidden sm:inline">Undo</span>
              <span className="sm:hidden">Undo</span>
            </Button>
          )}

          {availableActions.includes('update') && onBulkUpdate && (
            <Button
              onClick={onBulkUpdate}
              disabled={isOperationInProgress}
              variant="default"
              size="default"
              className="flex items-center justify-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Update
            </Button>
          )}

          {availableActions.includes('status') && onBulkStatusChange && (
            <Button
              onClick={onBulkStatusChange}
              disabled={isOperationInProgress}
              variant="outline"
              size="default"
              className="flex items-center justify-center gap-2"
            >
              <CheckSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Change Status</span>
              <span className="sm:hidden">Status</span>
            </Button>
          )}

          {availableActions.includes('category') && onBulkCategoryChange && (
            <Button
              onClick={onBulkCategoryChange}
              disabled={isOperationInProgress}
              variant="outline"
              size="default"
              className="flex items-center justify-center gap-2"
            >
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Change Category</span>
              <span className="sm:hidden">Category</span>
            </Button>
          )}

          {availableActions.includes('price') && onBulkPriceUpdate && (
            <Button
              onClick={onBulkPriceUpdate}
              disabled={isOperationInProgress}
              variant="outline"
              size="default"
              className="flex items-center justify-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Update Prices</span>
              <span className="sm:hidden">Prices</span>
            </Button>
          )}

          {availableActions.includes('stock') && onBulkStockAdjust && (
            <Button
              onClick={onBulkStockAdjust}
              disabled={isOperationInProgress}
              variant="outline"
              size="default"
              className="flex items-center justify-center gap-2"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Adjust Stock</span>
              <span className="sm:hidden">Stock</span>
            </Button>
          )}



          {availableActions.includes('delete') && onBulkDelete && (
            <Button
              onClick={onBulkDelete}
              disabled={isOperationInProgress}
              variant="outline"
              size="default"
              className="flex items-center justify-center gap-2 border-red-300 text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}

          <Button
            onClick={onClearSelection}
            disabled={isOperationInProgress}
            variant="outline"
            size="default"
            className="flex items-center justify-center gap-2 col-span-2 sm:col-span-1"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
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

