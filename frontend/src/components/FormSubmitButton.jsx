/**
 * Form Submit Button Component
 * Prevents submission when form has errors and shows validation summary
 */

import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { LoadingButton } from './LoadingSpinner';
import ValidationSummary from './ValidationSummary';

export const FormSubmitButton = ({
  errors = {},
  isValid = true,
  isSubmitting = false,
  onSubmit,
  submitText = 'Submit',
  cancelText = 'Cancel',
  onCancel,
  showValidationSummary = true,
  validationSummaryTitle = 'Please fix the following errors before submitting:',
  className = '',
  buttonClassName = '',
  disabled = false,
  ...buttonProps
}) => {
  const [showSummary, setShowSummary] = useState(false);
  const errorCount = Object.values(errors).filter(e => e !== null && e !== undefined).length;
  const hasErrors = errorCount > 0;

  const handleClick = (e) => {
    if (hasErrors && !isValid) {
      e.preventDefault();
      setShowSummary(true);
      // Auto-focus first error field
      const firstErrorField = Object.keys(errors).find(key => errors[key]);
      if (firstErrorField) {
        const fieldElement = document.querySelector(`[name="${firstErrorField}"], #${firstErrorField}`);
        if (fieldElement) {
          setTimeout(() => {
            fieldElement.focus();
            fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      }
      return;
    }

    if (onSubmit) {
      onSubmit(e);
    }
  };

  return (
    <div className={className}>
      {showValidationSummary && showSummary && hasErrors && (
        <div className="mb-4">
          <ValidationSummary
            errors={errors}
            title={validationSummaryTitle}
            onFieldClick={(fieldName) => {
              const fieldElement = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
              if (fieldElement) {
                fieldElement.focus();
                fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
          />
        </div>
      )}

      <div className="flex items-center justify-end space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
        )}
        
        <LoadingButton
          type="submit"
          isLoading={isSubmitting}
          disabled={disabled || hasErrors || !isValid}
          onClick={handleClick}
          className={`px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
          {...buttonProps}
        >
          {hasErrors && !isSubmitting && (
            <AlertTriangle className="h-4 w-4 mr-2" />
          )}
          {submitText}
        </LoadingButton>
      </div>

      {hasErrors && !showSummary && (
        <p className="mt-2 text-sm text-red-600 flex items-center">
          <AlertTriangle className="h-4 w-4 mr-1" />
          Please fix {errorCount} {errorCount === 1 ? 'error' : 'errors'} before submitting
        </p>
      )}
    </div>
  );
};

export default FormSubmitButton;

