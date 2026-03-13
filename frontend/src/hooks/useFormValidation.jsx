import { useState, useCallback, useEffect } from 'react';
import { FIELD_VALIDATORS, sanitizeFormData } from '../utils/validation';
import { sanitizeFormData as sanitizeFormDataUtil } from '../utils/sanitization';

export const useFormValidation = (initialValues = {}, validationRules = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isValidating, setIsValidating] = useState({});
  const [isFormValid, setIsFormValid] = useState(false);

  // Update form validity whenever values or errors change
  useEffect(() => {
    const hasErrors = Object.values(errors).some(error => error !== null);
    setIsFormValid(!hasErrors);
  }, [values, errors]);

  // Get validator for a field
  const getFieldValidator = useCallback((fieldName) => {
    try {
      // Check if custom validator is provided
      if (validationRules[fieldName]) {
        const validator = validationRules[fieldName];
        
        // Check if it's a function
        if (typeof validator !== 'function') {
          // If it's an array with includes method, this is the old pattern
          if (Array.isArray(validator) && validator.includes) {
            return null; // Return null to avoid error
          }
        }
        
        return validator;
      }
      
      // Use predefined validators
      return FIELD_VALIDATORS[fieldName] || null;
    } catch (error) {
      throw error;
    }
  }, [validationRules]);

  // Validate a single field
  const validateField = useCallback((fieldName, value) => {
    const validator = getFieldValidator(fieldName);
    if (!validator) return null;
    
    return validator(value);
  }, [getFieldValidator]);

  // Debounced validation for real-time feedback
  const debouncedValidateField = useCallback((fieldName, value, callback) => {
    const validator = getFieldValidator(fieldName);
    if (!validator) {
      callback(null);
      return;
    }

    setIsValidating(prev => ({ ...prev, [fieldName]: true }));
    
    // Debounce validation
    const timeoutId = setTimeout(() => {
      const error = validator(value);
      callback(error);
      setIsValidating(prev => ({ ...prev, [fieldName]: false }));
    }, 300);
    
    // Return cleanup function
    return () => clearTimeout(timeoutId);
  }, [getFieldValidator]);

  // Handle input change
  const handleChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    let fieldValue = type === 'checkbox' ? checked : value;
    
    // Sanitize input value
    if (typeof fieldValue === 'string') {
      fieldValue = sanitizeFormDataUtil({ [name]: fieldValue })[name];
    }
    
    setValues(prev => ({ ...prev, [name]: fieldValue }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
    
    // Validate field with debounce
    debouncedValidateField(name, fieldValue, (error) => {
      setErrors(prev => ({ ...prev, [name]: error }));
    });
  }, [errors, debouncedValidateField]);

  // Handle input blur
  const handleBlur = useCallback((event) => {
    const { name, value } = event.target;
    
    setTouched(prev => ({ ...prev, [name]: true }));
    
    // Immediate validation on blur
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  }, [validateField]);

  // Validate entire form
  const validateForm = useCallback((options = {}) => {
    const { focusFirstError = false, scrollToFirstError = false } = options;
    const newErrors = {};
    
    Object.keys(validationRules).forEach(fieldName => {
      const validator = getFieldValidator(fieldName);
      if (validator) {
        const error = validator(values[fieldName]);
        if (error) {
          newErrors[fieldName] = error;
        }
      }
    });
    
    setErrors(newErrors);
    setTouched(Object.keys(validationRules).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    
    // Auto-focus on first error field
    if (focusFirstError && Object.keys(newErrors).length > 0) {
      const firstErrorField = Object.keys(newErrors)[0];
      setTimeout(() => {
        const fieldElement = document.querySelector(`[name="${firstErrorField}"], #${firstErrorField}`);
        if (fieldElement) {
          fieldElement.focus();
          if (scrollToFirstError) {
            fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 100);
    }
    
    return Object.keys(newErrors).length === 0;
  }, [validationRules, values, getFieldValidator]);

  // Reset form
  const resetForm = useCallback((newValues = initialValues) => {
    setValues(newValues);
    setErrors({});
    setTouched({});
    setIsValidating({});
  }, [initialValues]);

  // Set specific error
  const setError = useCallback((fieldName, error) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));
  }, []);

  // Clear specific error
  const clearError = useCallback((fieldName) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  // Get field props for validated inputs
  const getFieldProps = useCallback((fieldName, options = {}) => {
    try {
      return {
        name: fieldName,
        value: values[fieldName] || '',
        onChange: handleChange,
        onBlur: handleBlur,
        error: errors[fieldName],
        validator: getFieldValidator(fieldName),
        required: false,
        ...options
      };
    } catch (error) {
      throw error;
    }
  }, [values, errors, handleChange, handleBlur, getFieldValidator]);

  // Get form status
  const getFormStatus = useCallback(() => {
    const hasErrors = Object.values(errors).some(error => error !== null);
    const isTouched = Object.values(touched).some(touched => touched);
    
    return {
      isValid: !hasErrors,
      hasErrors,
      isTouched,
      isSubmitting: false
    };
  }, [errors, touched]);

  // Get sanitized form data
  const getSanitizedData = useCallback(() => {
    return sanitizeFormDataUtil(values);
  }, [values]);

  // Get first error field name
  const getFirstErrorField = useCallback(() => {
    const errorFields = Object.keys(errors).filter(key => errors[key] !== null && errors[key] !== undefined);
    return errorFields.length > 0 ? errorFields[0] : null;
  }, [errors]);

  // Focus on first error field
  const focusFirstError = useCallback((scrollIntoView = true) => {
    const firstErrorField = getFirstErrorField();
    if (firstErrorField) {
      setTimeout(() => {
        const fieldElement = document.querySelector(`[name="${firstErrorField}"], #${firstErrorField}`);
        if (fieldElement) {
          fieldElement.focus();
          if (scrollIntoView) {
            fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 100);
    }
  }, [getFirstErrorField]);

  // Get error count
  const getErrorCount = useCallback(() => {
    return Object.values(errors).filter(error => error !== null && error !== undefined).length;
  }, [errors]);

  // Get actionable error messages (formatted for display)
  const getActionableErrors = useCallback(() => {
    const actionableErrors = {};
    Object.entries(errors).forEach(([fieldName, error]) => {
      if (error) {
        // Format field name for display
        const displayName = fieldName
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .trim();
        actionableErrors[fieldName] = {
          field: fieldName,
          displayName,
          message: error,
          // Extract actionable parts from error message
          action: error.includes('required') ? 'Fill in this field' :
                 error.includes('minimum') ? 'Increase the value' :
                 error.includes('maximum') ? 'Decrease the value' :
                 error.includes('invalid') ? 'Check the format' :
                 'Fix this field'
        };
      }
    });
    return actionableErrors;
  }, [errors]);

  return {
    values,
    errors,
    touched,
    isValidating,
    isFormValid,
    handleChange,
    handleBlur,
    validateForm,
    validateField,
    resetForm,
    setError,
    clearError,
    getFieldProps,
    getFormStatus,
    getFieldValidator,
    getSanitizedData,
    getFirstErrorField,
    focusFirstError,
    getErrorCount,
    getActionableErrors
  };
};