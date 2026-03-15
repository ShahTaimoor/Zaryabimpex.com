// Backend sanitization utilities

// Basic input sanitization
const sanitizeInput = (input) => {
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
const sanitizeObject = (obj) => {
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
  
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }
  
  return obj;
};

// Sanitize email
const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  return sanitizeInput(email).toLowerCase().trim();
};

// Sanitize phone number
const sanitizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  return sanitizeInput(phone)
    .replace(/[^\d+]/g, '') // Keep only digits and plus sign
    .substring(0, 20); // Limit length
};

// Sanitize SKU
const sanitizeSKU = (sku) => {
  if (!sku || typeof sku !== 'string') return '';
  return sanitizeInput(sku)
    .toUpperCase()
    .replace(/[^A-Z0-9\-_]/g, '') // Keep only alphanumeric, hyphens, underscores
    .substring(0, 20); // Limit length
};

// Sanitize barcode
const sanitizeBarcode = (barcode) => {
  if (!barcode || typeof barcode !== 'string') return '';
  return sanitizeInput(barcode)
    .replace(/[^\d]/g, '') // Keep only digits
    .substring(0, 14); // Limit length
};

// Sanitize numeric input
const sanitizeNumeric = (input) => {
  if (typeof input === 'number') return input;
  if (typeof input !== 'string') return null;
  
  // Remove all non-numeric characters except decimal point and minus sign
  const cleaned = input.replace(/[^0-9.-]/g, '');
  
  // Validate numeric format
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

// Sanitize currency amount
const sanitizeCurrency = (amount) => {
  const num = sanitizeNumeric(amount);
  if (num === null) return null;
  
  // Round to 2 decimal places
  return Math.round(num * 100) / 100;
};

// Sanitize integer
const sanitizeInteger = (input) => {
  const num = sanitizeNumeric(input);
  if (num === null) return null;
  
  return Math.round(num);
};

// Sanitize positive number
const sanitizePositiveNumber = (input) => {
  const num = sanitizeNumeric(input);
  if (num === null || num < 0) return null;
  
  return num;
};

// Sanitize positive integer
const sanitizePositiveInteger = (input) => {
  const num = sanitizeInteger(input);
  if (num === null || num < 0) return null;
  
  return num;
};

// Sanitize percentage
const sanitizePercentage = (input) => {
  const num = sanitizeNumeric(input);
  if (num === null || num < 0 || num > 100) return null;
  
  return Math.round(num * 100) / 100;
};

// Sanitize date
const sanitizeDate = (date) => {
  if (!date) return null;
  
  if (typeof date === 'string') {
    const sanitized = sanitizeInput(date);
    const dateObj = new Date(sanitized);
    return isNaN(dateObj.getTime()) ? null : dateObj;
  }
  
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }
  
  return null;
};

// Sanitize boolean
const sanitizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const sanitized = sanitizeInput(value).toLowerCase();
    return sanitized === 'true' || sanitized === '1' || sanitized === 'yes';
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return false;
};

// Sanitize array
const sanitizeArray = (arr, itemSanitizer = sanitizeInput) => {
  if (!Array.isArray(arr)) return [];
  
  return arr
    .filter(item => item !== null && item !== undefined)
    .map(item => {
      if (typeof item === 'string') {
        return itemSanitizer(item);
      }
      if (typeof item === 'object') {
        return sanitizeObject(item);
      }
      return item;
    });
};

// Sanitize entity ID (PostgreSQL UUID or legacy 24-char hex)
const sanitizeObjectId = (id) => {
  if (!id || typeof id !== 'string') return null;
  
  const sanitized = sanitizeInput(id);
  // PostgreSQL UUID format
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sanitized)) {
    return sanitized;
  }
  // Legacy 24-char hex (MongoDB ObjectId)
  if (/^[0-9a-fA-F]{24}$/.test(sanitized)) {
    return sanitized;
  }
  
  return null;
};

// Sanitize search query
const sanitizeSearchQuery = (query) => {
  if (!query || typeof query !== 'string') return '';
  
  return sanitizeInput(query)
    .replace(/[%_]/g, '') // Remove SQL wildcards
    .replace(/[<>]/g, '') // Remove HTML tags
    .trim();
};

// Sanitize file name
const sanitizeFileName = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return '';
  
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid characters
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .substring(0, 255); // Limit length
};

// Sanitize URL
const sanitizeURL = (url) => {
  if (!url || typeof url !== 'string') return '';
  
  const sanitized = sanitizeInput(url);
  try {
    new URL(sanitized);
    return sanitized;
  } catch {
    return '';
  }
};

// Sanitize text content
const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  return sanitizeInput(text)
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

// Sanitize HTML content
const sanitizeHTML = (html) => {
  if (!html || typeof html !== 'string') return '';
  
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .trim();
};

// Sanitize CSV data
const sanitizeCSVData = (data) => {
  if (!Array.isArray(data)) return [];
  
  return data.map(row => {
    const sanitizedRow = {};
    
    for (const key in row) {
      if (row.hasOwnProperty(key)) {
        const sanitizedKey = sanitizeInput(key);
        let value = row[key];
        
        if (typeof value === 'string') {
          value = sanitizeInput(value);
        }
        
        sanitizedRow[sanitizedKey] = value;
      }
    }
    
    return sanitizedRow;
  });
};

// Sanitize object with specific field sanitizers
const sanitizeObjectWithRules = (obj, rules) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = {};
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const rule = rules[key];
      let value = obj[key];
      
      if (rule && typeof rule === 'function') {
        value = rule(value);
      } else {
        value = sanitizeObject(value);
      }
      
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// Common sanitization rules for different field types
const SANITIZATION_RULES = {
  name: sanitizeInput,
  email: sanitizeEmail,
  phone: sanitizePhone,
  sku: sanitizeSKU,
  barcode: sanitizeBarcode,
  numeric: sanitizeNumeric,
  currency: sanitizeCurrency,
  integer: sanitizeInteger,
  positiveNumber: sanitizePositiveNumber,
  positiveInteger: sanitizePositiveInteger,
  percentage: sanitizePercentage,
  date: sanitizeDate,
  boolean: sanitizeBoolean,
  array: sanitizeArray,
  objectId: sanitizeObjectId,
  search: sanitizeSearchQuery,
  fileName: sanitizeFileName,
  url: sanitizeURL,
  text: sanitizeText,
  html: sanitizeHTML,
  csv: sanitizeCSVData
};

module.exports = {
  sanitizeInput,
  sanitizeObject,
  sanitizeEmail,
  sanitizePhone,
  sanitizeSKU,
  sanitizeBarcode,
  sanitizeNumeric,
  sanitizeCurrency,
  sanitizeInteger,
  sanitizePositiveNumber,
  sanitizePositiveInteger,
  sanitizePercentage,
  sanitizeDate,
  sanitizeBoolean,
  sanitizeArray,
  sanitizeObjectId,
  sanitizeSearchQuery,
  sanitizeFileName,
  sanitizeURL,
  sanitizeText,
  sanitizeHTML,
  sanitizeCSVData,
  sanitizeObjectWithRules,
  SANITIZATION_RULES
};
