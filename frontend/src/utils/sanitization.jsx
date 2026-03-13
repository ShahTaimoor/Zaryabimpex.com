// Data sanitization utilities for API requests and responses

import { sanitizeObject, sanitizeInput, escapeHtml } from './validation';

// Sanitize API request data before sending
export const sanitizeRequestData = (data) => {
  if (!data) return data;
  
  // Don't sanitize databaseUrl field - connection string that needs to stay intact
  if (data.databaseUrl && typeof data.databaseUrl === 'string') {
    const databaseUrl = data.databaseUrl;
    const sanitized = sanitizeObject(data);
    sanitized.databaseUrl = databaseUrl; // Restore original databaseUrl without sanitization
    return sanitized;
  }
  
  // Deep sanitize the entire request object
  return sanitizeObject(data);
};

// Sanitize API response data before using
export const sanitizeResponseData = (data) => {
  if (!data) return data;
  
  // Use a lighter sanitization for API responses
  const sanitized = sanitizeObjectLight(data);
  // Normalize entities: add _id from id for PostgreSQL compatibility (frontend expects _id)
  return normalizeIdsForPostgres(sanitized);
};

// Ensure entities have _id for Postgres (backend returns id, frontend uses _id)
const normalizeIdsForPostgres = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeIdsForPostgres(item));
  }
  if (typeof obj === 'object') {
    const result = { ...obj };
    if (result.id !== undefined && result._id === undefined) {
      result._id = result.id;
    }
    for (const key in result) {
      if (result.hasOwnProperty(key) && typeof result[key] === 'object') {
        result[key] = normalizeIdsForPostgres(result[key]);
      }
    }
    return result;
  }
  return obj;
};

// Light sanitization that doesn't HTML-encode everything
export const sanitizeObjectLight = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectLight(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObjectLight(obj[key]);
      }
    }
    return sanitized;
  }
  
  // Only sanitize strings by trimming and removing dangerous characters
  if (typeof obj === 'string') {
    return obj
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+=/gi, '') // Remove event handlers
      .replace(/script/gi, '') // Remove script tags
      .replace(/&/g, '&amp;') // Only encode ampersands
      .replace(/"/g, '&quot;') // Only encode quotes
      .replace(/'/g, '&#x27;'); // Only encode single quotes
  }
  
  return obj;
};

// Sanitize form data before validation
export const sanitizeFormData = (formData) => {
  const sanitized = {};
  
  for (const key in formData) {
    if (formData.hasOwnProperty(key)) {
      let value = formData[key];
      
      // Handle different data types
      if (typeof value === 'string') {
        value = sanitizeInput(value);
      } else if (typeof value === 'object' && value !== null) {
        value = sanitizeObject(value);
      }
      
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// Sanitize search queries
export const sanitizeSearchQuery = (query) => {
  if (!query || typeof query !== 'string') return '';
  
  return sanitizeInput(query)
    .replace(/[%_]/g, '') // Remove SQL wildcards
    .replace(/[<>]/g, '') // Remove HTML tags
    .trim();
};

// Sanitize file names
export const sanitizeFileName = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return '';
  
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid characters
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .substring(0, 255); // Limit length
};

// Sanitize HTML content for display
export const sanitizeHTML = (html) => {
  if (!html || typeof html !== 'string') return '';
  
  return escapeHtml(html);
};

// Sanitize URL parameters
export const sanitizeURLParams = (params) => {
  if (!params || typeof params !== 'object') return {};
  
  const sanitized = {};
  
  for (const key in params) {
    if (params.hasOwnProperty(key)) {
      let value = params[key];
      
      if (typeof value === 'string') {
        value = sanitizeInput(value);
      } else if (Array.isArray(value)) {
        value = value.map(item => 
          typeof item === 'string' ? sanitizeInput(item) : item
        );
      }
      
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// Sanitize CSV/Excel data
export const sanitizeCSVData = (data) => {
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

// Sanitize user input for display
export const sanitizeForDisplay = (input) => {
  if (typeof input !== 'string') return input;
  
  return escapeHtml(sanitizeInput(input));
};

// Sanitize numeric input
export const sanitizeNumeric = (input) => {
  if (typeof input === 'number') return input;
  if (typeof input !== 'string') return null;
  
  // Remove all non-numeric characters except decimal point and minus sign
  const cleaned = input.replace(/[^0-9.-]/g, '');
  
  // Validate numeric format
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

// Sanitize email input
export const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  
  return sanitizeInput(email)
    .toLowerCase()
    .trim();
};

// Sanitize phone number input
export const sanitizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  
  return sanitizeInput(phone)
    .replace(/[^\d+]/g, '') // Keep only digits and plus sign
    .substring(0, 20); // Limit length
};

// Sanitize address input
export const sanitizeAddress = (address) => {
  if (!address || typeof address !== 'string') return '';
  
  return sanitizeInput(address)
    .replace(/[<>]/g, '') // Remove HTML tags
    .trim();
};

// Sanitize notes/description input
export const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  return sanitizeInput(text)
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

// SKU and barcode sanitization functions removed - using product name as unique identifier

// Sanitize password input (basic sanitization, don't escape)
export const sanitizePassword = (password) => {
  if (!password || typeof password !== 'string') return '';
  
  return password.trim();
};

// Sanitize date input
export const sanitizeDate = (date) => {
  if (!date) return null;
  
  if (typeof date === 'string') {
    const sanitized = sanitizeInput(date);
    const dateObj = new Date(sanitized);
    return isNaN(dateObj.getTime()) ? null : sanitized;
  }
  
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  
  return null;
};

// Sanitize boolean input
export const sanitizeBoolean = (value) => {
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

// Sanitize array input
export const sanitizeArray = (arr, itemSanitizer = sanitizeInput) => {
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

// Sanitize object with specific field sanitizers
export const sanitizeObjectWithRules = (obj, rules) => {
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
export const SANITIZATION_RULES = {
  name: sanitizeInput,
  email: sanitizeEmail,
  phone: sanitizePhone,
  address: sanitizeAddress,
  description: sanitizeText,
  notes: sanitizeText,
  // sku and barcode fields removed
  password: sanitizePassword,
  date: sanitizeDate,
  numeric: sanitizeNumeric,
  boolean: sanitizeBoolean,
  array: sanitizeArray,
  text: sanitizeText,
  html: sanitizeHTML
};

export default {
  sanitizeRequestData,
  sanitizeResponseData,
  sanitizeFormData,
  sanitizeSearchQuery,
  sanitizeFileName,
  sanitizeHTML,
  sanitizeURLParams,
  sanitizeCSVData,
  sanitizeForDisplay,
  sanitizeNumeric,
  sanitizeEmail,
  sanitizePhone,
  sanitizeAddress,
  sanitizeText,
  // sanitizeSKU and sanitizeBarcode removed
  sanitizePassword,
  sanitizeDate,
  sanitizeBoolean,
  sanitizeArray,
  sanitizeObjectWithRules,
  SANITIZATION_RULES
};
