import React, { useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  X, 
  Info, 
  CheckCircle, 
  XCircle,
  Shield
} from 'lucide-react';

const ConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning", // warning, danger, info, success
  isLoading = false,
  confirmButtonProps = {},
  cancelButtonProps = {},
  children
}) => {
  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <Trash2 className="h-6 w-6 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
      case 'info':
        return <Info className="h-6 w-6 text-blue-600" />;
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      default:
        return <AlertTriangle className="h-6 w-6 text-gray-600" />;
    }
  };

  const getIconBgColor = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-100';
      case 'warning':
        return 'bg-yellow-100';
      case 'info':
        return 'bg-blue-100';
      case 'success':
        return 'bg-green-100';
      default:
        return 'bg-gray-100';
    }
  };

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'danger':
        return 'border-red-300 bg-white text-red-700 hover:bg-red-50 focus:ring-red-500 active:bg-red-100';
      case 'warning':
        return 'border-yellow-300 bg-white text-yellow-700 hover:bg-yellow-50 focus:ring-yellow-500 active:bg-yellow-100';
      case 'info':
        return 'border-blue-300 bg-white text-blue-700 hover:bg-blue-50 focus:ring-blue-500 active:bg-blue-100';
      case 'success':
        return 'border-green-300 bg-white text-green-700 hover:bg-green-50 focus:ring-green-500 active:bg-green-100';
      default:
        return 'border-primary-300 bg-white text-primary-700 hover:bg-primary-50 focus:ring-primary-500 active:bg-primary-100';
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && !isLoading) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleBackdropClick}
        />

        {/* Dialog */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              {/* Icon */}
              <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${getIconBgColor()} sm:mx-0 sm:h-10 sm:w-10`}>
                {getIcon()}
              </div>
              
              {/* Content */}
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {title}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {message}
                  </p>
                  {children && (
                    <div className="mt-3">
                      {children}
                    </div>
                  )}
                </div>
              </div>

              {/* Close button */}
              {!isLoading && (
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse sm:gap-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`w-full inline-flex justify-center rounded-md border shadow-sm px-6 py-2.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed ${getConfirmButtonColor()}`}
              {...confirmButtonProps}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                confirmText
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-6 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              {...cancelButtonProps}
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Specialized confirmation dialogs
export const DeleteConfirmationDialog = ({ isOpen, onClose, onConfirm, itemName, itemType = "item", isLoading = false }) => (
  <ConfirmationDialog
    isOpen={isOpen}
    onClose={onClose}
    onConfirm={onConfirm}
    title={`Delete ${itemType}`}
    message={`Are you sure you want to delete "${itemName}"? This action cannot be undone.`}
    confirmText="Delete"
    type="danger"
    isLoading={isLoading}
  />
);

export const CancelConfirmationDialog = ({ isOpen, onClose, onConfirm, itemName, itemType = "order", isLoading = false }) => (
  <ConfirmationDialog
    isOpen={isOpen}
    onClose={onClose}
    onConfirm={onConfirm}
    title={`Cancel ${itemType}`}
    message={`Are you sure you want to cancel "${itemName}"? This action cannot be undone.`}
    confirmText="Cancel Order"
    type="warning"
    isLoading={isLoading}
    confirmButtonProps={{
      className: "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500"
    }}
  />
);

export const ClearConfirmationDialog = ({ isOpen, onClose, onConfirm, itemCount = 0, itemType = "items", isLoading = false }) => (
  <ConfirmationDialog
    isOpen={isOpen}
    onClose={onClose}
    onConfirm={onConfirm}
    title="Clear All Items"
    message={`Are you sure you want to clear all ${itemCount} ${itemType}? This action cannot be undone.`}
    confirmText="Clear All"
    type="warning"
    isLoading={isLoading}
  >
    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-3">
      <div className="flex">
        <Shield className="h-5 w-5 text-yellow-400 mr-2" />
        <div className="text-sm">
          <p className="text-yellow-800 font-medium">Warning</p>
          <p className="text-yellow-700">All items will be removed from the current session.</p>
        </div>
      </div>
    </div>
  </ConfirmationDialog>
);

export const BulkDeleteConfirmationDialog = ({ isOpen, onClose, onConfirm, itemCount = 0, itemType = "items", isLoading = false }) => (
  <ConfirmationDialog
    isOpen={isOpen}
    onClose={onClose}
    onConfirm={onConfirm}
    title="Bulk Delete"
    message={`Are you sure you want to delete ${itemCount} ${itemType}? This action cannot be undone.`}
    confirmText={`Delete ${itemCount} Items`}
    type="danger"
    isLoading={isLoading}
  >
    <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3">
      <div className="flex">
        <XCircle className="h-5 w-5 text-red-400 mr-2" />
        <div className="text-sm">
          <p className="text-red-800 font-medium">This action is permanent</p>
          <p className="text-red-700">All selected items will be permanently deleted.</p>
        </div>
      </div>
    </div>
  </ConfirmationDialog>
);

export default ConfirmationDialog;
