import React, { useState, useEffect, forwardRef } from 'react';
import { AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

// Validated Input Component with real-time validation
const ValidatedInput = forwardRef(({
  type = 'text',
  label,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  validator,
  error,
  showError = true,
  showSuccess = true,
  debounceMs = 300,
  required = false,
  disabled = false,
  className = '',
  inputClassName = '',
  labelClassName = '',
  helpText,
  ...props
}, ref) => {
  const [localError, setLocalError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [hasBeenTouched, setHasBeenTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  // Debounced validation
  useEffect(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!validator || !hasBeenTouched) return;

    setIsValidating(true);
    const newTimeoutId = setTimeout(() => {
      const validationError = validator(value);
      setLocalError(validationError);
      setIsValidating(false);
    }, debounceMs);

    setTimeoutId(newTimeoutId);

    return () => {
      if (newTimeoutId) {
        clearTimeout(newTimeoutId);
      }
    };
  }, [value, validator, debounceMs, hasBeenTouched]);

  // Clear validation on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  const handleBlur = (e) => {
    setHasBeenTouched(true);
    if (validator) {
      const validationError = validator(value);
      setLocalError(validationError);
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleChange = (e) => {
    if (onChange) {
      onChange(e);
    }
  };

  const displayError = error || localError;
  const isValid = !displayError && value && hasBeenTouched;
  const shouldShowError = showError && displayError && hasBeenTouched;
  const shouldShowSuccess = showSuccess && isValid && !isValidating;

  const inputType = type === 'password' && showPassword ? 'text' : type;

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label 
          htmlFor={name}
          className={`block text-sm font-medium text-gray-700 ${labelClassName}`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={ref}
          type={inputType}
          name={name}
          id={name}
          value={value || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            input w-full pr-10
            ${shouldShowError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
            ${shouldShowSuccess ? 'border-green-300 focus:border-green-500 focus:ring-green-500' : ''}
            ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}
            ${inputClassName}
          `}
          {...props}
        />
        
        {/* Password toggle */}
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-8 flex items-center pr-3 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
        
        {/* Validation icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {isValidating && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
          {shouldShowError && (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          {shouldShowSuccess && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
        </div>
      </div>
      
      {/* Help text */}
      {helpText && !shouldShowError && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
      
      {/* Error message - Enhanced with actionable guidance */}
      {shouldShowError && (
        <div className="text-xs text-red-600">
          <p className="flex items-center font-medium">
            <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
            {displayError}
          </p>
          {/* Actionable hint */}
          {displayError && (
            <p className="mt-1 text-red-500 italic">
              {displayError.includes('required') && 'This field is required'}
              {displayError.includes('minimum') && 'Please enter a higher value'}
              {displayError.includes('maximum') && 'Please enter a lower value'}
              {displayError.includes('length') && 'Please check the length'}
              {displayError.includes('format') && 'Please check the format'}
              {displayError.includes('invalid') && 'Please enter a valid value'}
            </p>
          )}
        </div>
      )}
      
      {/* Success message */}
      {shouldShowSuccess && (
        <p className="text-xs text-green-600 flex items-center">
          <CheckCircle className="h-3 w-3 mr-1" />
          Looks good!
        </p>
      )}
    </div>
  );
});

ValidatedInput.displayName = 'ValidatedInput';

// Validated Textarea Component
export const ValidatedTextarea = forwardRef(({
  label,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  validator,
  error,
  showError = true,
  showSuccess = true,
  debounceMs = 300,
  required = false,
  disabled = false,
  rows = 3,
  className = '',
  labelClassName = '',
  helpText,
  ...props
}, ref) => {
  const [localError, setLocalError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [hasBeenTouched, setHasBeenTouched] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  useEffect(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!validator || !hasBeenTouched) return;

    setIsValidating(true);
    const newTimeoutId = setTimeout(() => {
      const validationError = validator(value);
      setLocalError(validationError);
      setIsValidating(false);
    }, debounceMs);

    setTimeoutId(newTimeoutId);

    return () => {
      if (newTimeoutId) {
        clearTimeout(newTimeoutId);
      }
    };
  }, [value, validator, debounceMs, hasBeenTouched]);

  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  const handleBlur = (e) => {
    setHasBeenTouched(true);
    if (validator) {
      const validationError = validator(value);
      setLocalError(validationError);
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleChange = (e) => {
    if (onChange) {
      onChange(e);
    }
  };

  const displayError = error || localError;
  const isValid = !displayError && value && hasBeenTouched;
  const shouldShowError = showError && displayError && hasBeenTouched;
  const shouldShowSuccess = showSuccess && isValid && !isValidating;

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label 
          htmlFor={name}
          className={`block text-sm font-medium text-gray-700 ${labelClassName}`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <textarea
          ref={ref}
          name={name}
          id={name}
          value={value || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={`
            input w-full resize-none
            ${shouldShowError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
            ${shouldShowSuccess ? 'border-green-300 focus:border-green-500 focus:ring-green-500' : ''}
            ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}
          `}
          {...props}
        />
        
        {/* Validation indicator */}
        <div className="absolute top-2 right-2">
          {isValidating && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
          {shouldShowError && (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          {shouldShowSuccess && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
        </div>
      </div>
      
      {/* Help text */}
      {helpText && !shouldShowError && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
      
      {/* Error message - Enhanced with actionable guidance */}
      {shouldShowError && (
        <div className="text-xs text-red-600">
          <p className="flex items-center font-medium">
            <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
            {displayError}
          </p>
          {/* Actionable hint */}
          {displayError && (
            <p className="mt-1 text-red-500 italic">
              {displayError.includes('required') && 'This field is required'}
              {displayError.includes('minimum') && 'Please enter a higher value'}
              {displayError.includes('maximum') && 'Please enter a lower value'}
              {displayError.includes('length') && 'Please check the length'}
              {displayError.includes('format') && 'Please check the format'}
              {displayError.includes('invalid') && 'Please enter a valid value'}
            </p>
          )}
        </div>
      )}
      
      {/* Success message */}
      {shouldShowSuccess && (
        <p className="text-xs text-green-600 flex items-center">
          <CheckCircle className="h-3 w-3 mr-1" />
          Looks good!
        </p>
      )}
    </div>
  );
});

ValidatedTextarea.displayName = 'ValidatedTextarea';

// Validated Select Component
export const ValidatedSelect = forwardRef(({
  label,
  name,
  value,
  onChange,
  onBlur,
  validator,
  error,
  showError = true,
  showSuccess = true,
  required = false,
  disabled = false,
  options = [],
  placeholder = 'Select an option...',
  className = '',
  labelClassName = '',
  helpText,
  ...props
}, ref) => {
  const [localError, setLocalError] = useState(null);
  const [hasBeenTouched, setHasBeenTouched] = useState(false);

  const handleBlur = (e) => {
    setHasBeenTouched(true);
    if (validator) {
      const validationError = validator(value);
      setLocalError(validationError);
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleChange = (e) => {
    if (validator) {
      const validationError = validator(e.target.value);
      setLocalError(validationError);
    }
    if (onChange) {
      onChange(e);
    }
  };

  const displayError = error || localError;
  const isValid = !displayError && value && hasBeenTouched;
  const shouldShowError = showError && displayError && hasBeenTouched;
  const shouldShowSuccess = showSuccess && isValid;

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label 
          htmlFor={name}
          className={`block text-sm font-medium text-gray-700 ${labelClassName}`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <select
          ref={ref}
          name={name}
          id={name}
          value={value || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          className={`
            input w-full pr-10
            ${shouldShowError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
            ${shouldShowSuccess ? 'border-green-300 focus:border-green-500 focus:ring-green-500' : ''}
            ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}
          `}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        {/* Validation icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {shouldShowError && (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          {shouldShowSuccess && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
        </div>
      </div>
      
      {/* Help text */}
      {helpText && !shouldShowError && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
      
      {/* Error message - Enhanced with actionable guidance */}
      {shouldShowError && (
        <div className="text-xs text-red-600">
          <p className="flex items-center font-medium">
            <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
            {displayError}
          </p>
          {/* Actionable hint */}
          {displayError && (
            <p className="mt-1 text-red-500 italic">
              {displayError.includes('required') && 'This field is required'}
              {displayError.includes('minimum') && 'Please enter a higher value'}
              {displayError.includes('maximum') && 'Please enter a lower value'}
              {displayError.includes('length') && 'Please check the length'}
              {displayError.includes('format') && 'Please check the format'}
              {displayError.includes('invalid') && 'Please enter a valid value'}
            </p>
          )}
        </div>
      )}
      
      {/* Success message */}
      {shouldShowSuccess && (
        <p className="text-xs text-green-600 flex items-center">
          <CheckCircle className="h-3 w-3 mr-1" />
          Looks good!
        </p>
      )}
    </div>
  );
});

ValidatedSelect.displayName = 'ValidatedSelect';

export default ValidatedInput;
