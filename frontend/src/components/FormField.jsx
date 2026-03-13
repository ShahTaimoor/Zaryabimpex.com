import React from 'react';

/**
 * FormField - Reusable form field wrapper with label and error display
 *
 * Props:
 *   - label: string - Field label
 *   - error: string - Error message (shows below input)
 *   - required: boolean - Shows asterisk (default: false)
 *   - helpText: string - Help text below input (shown when no error)
 *   - htmlFor: string - Associates label with input (use input id)
 *   - className: string - Additional wrapper classes
 *   - labelClassName: string - Additional label classes
 *   - children: ReactNode - The input/select/textarea element
 */
const FormField = ({
  label,
  error,
  required = false,
  helpText,
  htmlFor,
  className = '',
  labelClassName = '',
  children
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className={`block text-sm font-medium text-gray-700 mb-1 ${labelClassName}`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {helpText && !error && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 flex items-center">
          {error}
        </p>
      )}
    </div>
  );
};

export default FormField;
