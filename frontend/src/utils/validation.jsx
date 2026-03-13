// Enhanced validation and sanitization utilities

// Input sanitization functions
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/script/gi, '') // Remove script tags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Sanitize object recursively
export const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  // Only sanitize strings, preserve numbers, booleans, etc.
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }
  
  return obj;
};

// Enhanced validation functions
export const validateRequired = (value, fieldName = 'This field') => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return `${fieldName} is required`;
  }
  return null;
};

export const validateMinLength = (value, minLength, fieldName = 'This field') => {
  if (!value) return null;
  if (value.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters long`;
  }
  return null;
};

export const validateMaxLength = (value, maxLength, fieldName = 'This field') => {
  if (!value) return null;
  if (value.length > maxLength) {
    return `${fieldName} must be no more than ${maxLength} characters long`;
  }
  return null;
};

export const validateEmail = (email) => {
  if (!email) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? null : 'Please enter a valid email address';
};

export const validatePhone = (phone) => {
  if (!phone) return null;
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  return phoneRegex.test(cleanPhone) ? null : 'Please enter a valid phone number';
};

export const validateNumeric = (value, fieldName = 'This field') => {
  if (!value) return null;
  if (isNaN(value) || value === '') {
    return `${fieldName} must be a valid number`;
  }
  return null;
};

export const validatePositiveNumber = (value, fieldName = 'This field') => {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) {
    return `${fieldName} must be a positive number`;
  }
  return null;
};

export const validateInteger = (value, fieldName = 'This field') => {
  if (!value) return null;
  const num = parseInt(value, 10);
  if (isNaN(num) || !Number.isInteger(parseFloat(value))) {
    return `${fieldName} must be a whole number`;
  }
  return null;
};

export const validatePositiveInteger = (value, fieldName = 'This field') => {
  if (!value) return null;
  const num = parseInt(value, 10);
  if (isNaN(num) || !Number.isInteger(parseFloat(value)) || num <= 0) {
    return `${fieldName} must be a positive whole number`;
  }
  return null;
};

export const validateCurrency = (value, fieldName = 'This field') => {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) {
    return `${fieldName} must be a valid currency amount`;
  }
  if (num > 999999.99) {
    return `${fieldName} must be less than 999,999.99`;
  }
  return null;
};

export const validatePercentage = (value, fieldName = 'This field') => {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num) || num < 0 || num > 100) {
    return `${fieldName} must be between 0 and 100`;
  }
  return null;
};

// SKU and barcode validation functions removed - using product name as unique identifier

export const validatePassword = (password) => {
  if (!password) return null;
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/(?=.*[a-z])/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/(?=.*[A-Z])/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/(?=.*\d)/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
};

export const validateDate = (date, fieldName = 'This field') => {
  if (!date) return null;
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return `${fieldName} must be a valid date`;
  }
  return null;
};

export const validateFutureDate = (date, fieldName = 'This field') => {
  if (!date) return null;
  const dateObj = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (isNaN(dateObj.getTime())) {
    return `${fieldName} must be a valid date`;
  }
  
  if (dateObj < today) {
    return `${fieldName} must be a future date`;
  }
  
  return null;
};

export const validateURL = (url) => {
  if (!url) return null;
  try {
    new URL(url);
    return null;
  } catch {
    return 'Please enter a valid URL';
  }
};

export const validateFileType = (file, allowedTypes = []) => {
  if (!file) return null;
  if (allowedTypes.length === 0) return null;
  
  const fileType = file.type;
  const isValidType = allowedTypes.some(type => {
    if (type.includes('*')) {
      return fileType.startsWith(type.replace('*', ''));
    }
    return fileType === type;
  });
  
  if (!isValidType) {
    return `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`;
  }
  
  return null;
};

export const validateFileSize = (file, maxSizeInMB = 10) => {
  if (!file) return null;
  
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  if (file.size > maxSizeInBytes) {
    return `File size must be less than ${maxSizeInMB}MB`;
  }
  
  return null;
};

// XSS prevention
export const escapeHtml = (text) => {
  if (typeof text !== 'string') return text;
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

// SQL injection prevention (for display purposes)
export const sanitizeForSQL = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/['"]/g, '') // Remove quotes
    .replace(/;/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove block comments
    .replace(/\*\//g, '') // Remove block comments
    .replace(/union/gi, '') // Remove UNION
    .replace(/select/gi, '') // Remove SELECT
    .replace(/insert/gi, '') // Remove INSERT
    .replace(/update/gi, '') // Remove UPDATE
    .replace(/delete/gi, '') // Remove DELETE
    .replace(/drop/gi, '') // Remove DROP
    .replace(/create/gi, '') // Remove CREATE
    .replace(/alter/gi, '') // Remove ALTER
    .replace(/exec/gi, '') // Remove EXEC
    .replace(/execute/gi, '') // Remove EXECUTE
    .trim();
};

// Input length limits
export const INPUT_LIMITS = {
  NAME: 100,
  EMAIL: 255,
  PHONE: 20,
  ADDRESS: 500,
  DESCRIPTION: 1000,
  NOTES: 2000,
  SKU: 20,
  BARCODE: 14,
  PASSWORD: 128,
  CURRENCY: 10,
  PERCENTAGE: 5,
  QUANTITY: 6
};

// Validation rules for different field types
export const FIELD_VALIDATORS = {
  // Product fields
  productName: (value) => {
    const sanitized = sanitizeInput(value);
    return validateRequired(sanitized, 'Product name') ||
           validateMinLength(sanitized, 2, 'Product name') ||
           validateMaxLength(sanitized, INPUT_LIMITS.NAME, 'Product name');
  },
  
  // productSku and productBarcode validation removed - using product name as unique identifier
  
  productPrice: (value) => {
    const sanitized = sanitizeInput(value);
    return validateRequired(sanitized, 'Price') ||
           validateCurrency(sanitized, 'Price');
  },
  
  productStock: (value) => {
    const sanitized = sanitizeInput(value);
    return validateRequired(sanitized, 'Stock quantity') ||
           validatePositiveInteger(sanitized, 'Stock quantity');
  },
  
  productDescription: (value) => {
    const sanitized = sanitizeInput(value);
    return validateMaxLength(sanitized, INPUT_LIMITS.DESCRIPTION, 'Description');
  },
  
  // Customer fields
  customerName: (value) => {
    const sanitized = sanitizeInput(value);
    return validateRequired(sanitized, 'Customer name') ||
           validateMinLength(sanitized, 2, 'Customer name') ||
           validateMaxLength(sanitized, INPUT_LIMITS.NAME, 'Customer name');
  },
  
  customerEmail: (value) => {
    const sanitized = sanitizeInput(value);
    return validateEmail(sanitized);
  },
  
  customerPhone: (value) => {
    const sanitized = sanitizeInput(value);
    return validatePhone(sanitized);
  },
  
  customerAddress: (value) => {
    const sanitized = sanitizeInput(value);
    return validateMaxLength(sanitized, INPUT_LIMITS.ADDRESS, 'Address');
  },
  
  // Order fields
  orderQuantity: (value) => {
    const sanitized = sanitizeInput(value);
    return validateRequired(sanitized, 'Quantity') ||
           validatePositiveInteger(sanitized, 'Quantity');
  },
  
  orderPrice: (value) => {
    const sanitized = sanitizeInput(value);
    return validateRequired(sanitized, 'Price') ||
           validateCurrency(sanitized, 'Price');
  },
  
  expectedDelivery: (value) => {
    const sanitized = sanitizeInput(value);
    return validateFutureDate(sanitized, 'Expected delivery date');
  },
  
  // Payment fields
  amountPaid: (value) => {
    const sanitized = sanitizeInput(value);
    return validateCurrency(sanitized, 'Amount paid');
  },
  
  // Tax fields
  taxRate: (value) => {
    const sanitized = sanitizeInput(value);
    return validatePercentage(sanitized, 'Tax rate');
  }
};

// Combine multiple validators
export const combineValidators = (...validators) => {
  return (value) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return null;
  };
};

// Validate entire form
export const validateForm = (formData, validationRules) => {
  const errors = {};
  
  for (const field in validationRules) {
    const validator = validationRules[field];
    if (validator) {
      const error = validator(formData[field]);
      if (error) {
        errors[field] = error;
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Sanitize form data
export const sanitizeFormData = (formData) => {
  return sanitizeObject(formData);
};

// File validation
export const validateFile = (file, options = {}) => {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    maxSizeInMB = 10,
    required = false
  } = options;
  
  if (required && !file) {
    return 'File is required';
  }
  
  if (!file) return null;
  
  const typeError = validateFileType(file, allowedTypes);
  if (typeError) return typeError;
  
  const sizeError = validateFileSize(file, maxSizeInMB);
  if (sizeError) return sizeError;
  
  return null;
};

// CSV/Excel data validation
export const validateCSVData = (data, requiredFields = []) => {
  const errors = [];
  
  if (!Array.isArray(data) || data.length === 0) {
    errors.push('No data found in file');
    return { isValid: false, errors };
  }
  
  // Check for required fields
  const headers = Object.keys(data[0] || {});
  for (const field of requiredFields) {
    if (!headers.includes(field)) {
      errors.push(`Required field '${field}' is missing`);
    }
  }
  
  // Validate each row
  data.forEach((row, index) => {
    for (const field in row) {
      const value = row[field];
      if (typeof value === 'string') {
        // Check for potential XSS
        if (value.includes('<script') || value.includes('javascript:')) {
          errors.push(`Row ${index + 1}: Potential XSS detected in field '${field}'`);
        }
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// CSV sanitization helper: strip BOM and trim
export const sanitizeCSVData = (csvString) => {
  if (typeof csvString !== 'string') return csvString;
  return csvString.replace(/^\uFEFF/, '').trim();
};

export default {
  sanitizeInput,
  sanitizeObject,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  validateEmail,
  validatePhone,
  validateNumeric,
  validatePositiveNumber,
  validateInteger,
  validatePositiveInteger,
  validateCurrency,
  validatePercentage,
  // validateSKU and validateBarcode removed
  validatePassword,
  validateDate,
  validateFutureDate,
  validateURL,
  validateFileType,
  validateFileSize,
  escapeHtml,
  sanitizeForSQL,
  INPUT_LIMITS,
  FIELD_VALIDATORS,
  combineValidators,
  validateForm,
  sanitizeFormData,
  validateFile,
  validateCSVData
};
