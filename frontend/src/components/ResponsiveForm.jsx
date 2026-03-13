import React, { useState } from 'react';
import { useResponsive } from './ResponsiveContainer';
import { LoadingButton } from './LoadingSpinner';

const ResponsiveForm = ({
  children,
  onSubmit,
  loading = false,
  submitText = 'Submit',
  cancelText = 'Cancel',
  onCancel,
  className = '',
  showActions = true,
  fullWidth = false
}) => {
  const { isMobile, isTablet } = useResponsive();
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    }
  };

  const formClasses = `
    ${fullWidth ? 'w-full' : ''}
    ${isMobile ? 'space-y-4' : 'space-y-6'}
    ${className}
  `.trim();

  const actionClasses = `
    flex
    ${isMobile ? 'flex-col space-y-3' : 'flex-row space-x-3'}
    ${isMobile ? 'sticky bottom-0 bg-white p-4 border-t border-gray-200' : 'justify-end'}
  `.trim();

  return (
    <form onSubmit={handleSubmit} className={formClasses}>
      <div className="space-y-4">
        {children}
      </div>
      
      {showActions && (
        <div className={actionClasses}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={`
                px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md
                hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                ${isMobile ? 'w-full' : ''}
              `}
            >
              {cancelText}
            </button>
          )}
          <LoadingButton
            type="submit"
            loading={loading}
            className={`
              px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md
              hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
              ${isMobile ? 'w-full' : ''}
            `}
          >
            {submitText}
          </LoadingButton>
        </div>
      )}
    </form>
  );
};

// Responsive form field component
export const ResponsiveField = ({
  label,
  children,
  error,
  required = false,
  helpText,
  className = ''
}) => {
  const { isMobile } = useResponsive();

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className={`
          block text-sm font-medium text-gray-700
          ${required ? 'after:content-["*"] after:ml-0.5 after:text-red-500' : ''}
        `}>
          {label}
        </label>
      )}
      
      <div className={isMobile ? 'w-full' : ''}>
        {children}
      </div>
      
      {error && (
        <p className="text-sm text-red-600 flex items-center">
          <span className="mr-1">⚠</span>
          {error}
        </p>
      )}
      
      {helpText && (
        <p className="text-sm text-gray-500">{helpText}</p>
      )}
    </div>
  );
};

// Responsive input component
export const ResponsiveInput = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  required = false,
  className = '',
  ...props
}) => {
  const { isMobile } = useResponsive();

  const inputClasses = `
    block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
    placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500
    disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}
    ${isMobile ? 'text-base' : 'text-sm'}
    ${className}
  `.trim();

  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      required={required}
      className={inputClasses}
      {...props}
    />
  );
};

// Responsive textarea component
export const ResponsiveTextarea = ({
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  required = false,
  rows = 3,
  className = '',
  ...props
}) => {
  const { isMobile } = useResponsive();

  const textareaClasses = `
    block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
    placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500
    disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}
    ${isMobile ? 'text-base' : 'text-sm'}
    ${className}
  `.trim();

  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      required={required}
      rows={rows}
      className={textareaClasses}
      {...props}
    />
  );
};

// Responsive select component
export const ResponsiveSelect = ({
  options = [],
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  required = false,
  placeholder = 'Select an option',
  className = '',
  ...props
}) => {
  const { isMobile } = useResponsive();

  const selectClasses = `
    block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
    focus:outline-none focus:ring-primary-500 focus:border-primary-500
    disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}
    ${isMobile ? 'text-base' : 'text-sm'}
    ${className}
  `.trim();

  return (
    <select
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      required={required}
      className={selectClasses}
      {...props}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

// Responsive checkbox component
export const ResponsiveCheckbox = ({
  label,
  checked,
  onChange,
  onBlur,
  error,
  disabled = false,
  required = false,
  className = '',
  ...props
}) => {
  const { isMobile } = useResponsive();

  return (
    <div className={`flex items-start space-x-3 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        className={`
          h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          ${error ? 'border-red-300' : ''}
          ${isMobile ? 'mt-1' : 'mt-0.5'}
        `}
        {...props}
      />
      {label && (
        <label className={`
          text-sm font-medium text-gray-700
          ${disabled ? 'text-gray-500' : ''}
          ${required ? 'after:content-["*"] after:ml-0.5 after:text-red-500' : ''}
        `}>
          {label}
        </label>
      )}
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
};

// Responsive radio group component
export const ResponsiveRadioGroup = ({
  name,
  options = [],
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  className = '',
  ...props
}) => {
  const { isMobile } = useResponsive();

  return (
    <div className={`space-y-2 ${className}`}>
      {options.map((option) => (
        <div key={option.value} className="flex items-center space-x-3">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={onChange}
            disabled={disabled}
            required={required}
            className={`
              h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300
              disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
              ${error ? 'border-red-300' : ''}
            `}
            {...props}
          />
          <label className={`
            text-sm font-medium text-gray-700
            ${disabled ? 'text-gray-500' : ''}
          `}>
            {option.label}
          </label>
        </div>
      ))}
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
};

export default ResponsiveForm;
