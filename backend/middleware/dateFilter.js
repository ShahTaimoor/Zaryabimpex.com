/**
 * Date Filter Middleware
 * 
 * Processes date query parameters and adds date filters to request object.
 * All dates are handled in Pakistan Standard Time (Asia/Karachi).
 */

const { query } = require('express-validator');
const { parseDateParams, buildDateRangeFilter, isValidDateString } = require('../utils/dateFilter');

/**
 * Express validator for date query parameters
 * Supports multiple parameter name variations
 */
const validateDateParams = [
  query('dateFrom').optional().custom((value) => {
    if (value && !isValidDateString(value)) {
      throw new Error('dateFrom must be in YYYY-MM-DD format');
    }
    return true;
  }),
  query('dateTo').optional().custom((value) => {
    if (value && !isValidDateString(value)) {
      throw new Error('dateTo must be in YYYY-MM-DD format');
    }
    return true;
  }),
  query('startDate').optional().custom((value) => {
    if (value && !isValidDateString(value)) {
      throw new Error('startDate must be in YYYY-MM-DD format');
    }
    return true;
  }),
  query('endDate').optional().custom((value) => {
    if (value && !isValidDateString(value)) {
      throw new Error('endDate must be in YYYY-MM-DD format');
    }
    return true;
  }),
  query('fromDate').optional().custom((value) => {
    if (value && !isValidDateString(value)) {
      throw new Error('fromDate must be in YYYY-MM-DD format');
    }
    return true;
  }),
  query('toDate').optional().custom((value) => {
    if (value && !isValidDateString(value)) {
      throw new Error('toDate must be in YYYY-MM-DD format');
    }
    return true;
  }),
  query('from').optional().custom((value) => {
    if (value && !isValidDateString(value)) {
      throw new Error('from must be in YYYY-MM-DD format');
    }
    return true;
  }),
  query('to').optional().custom((value) => {
    if (value && !isValidDateString(value)) {
      throw new Error('to must be in YYYY-MM-DD format');
    }
    return true;
  })
];

/**
 * Middleware to process date filters and add to request
 * @param {string|Array<string>} fieldName - MongoDB field name(s) to filter on
 * @param {Object} options - Options object
 * @param {boolean} options.required - Whether date params are required (default: false)
 * @returns {Function} Express middleware function
 */
const processDateFilter = (fieldName = 'createdAt', options = {}) => {
  return (req, res, next) => {
    try {
      const { startDate, endDate } = parseDateParams(req.query);
      
      // If dates are required but not provided
      if (options.required && (!startDate || !endDate)) {
        return res.status(400).json({
          message: 'Both startDate and endDate are required',
          errors: [{
            field: !startDate ? 'startDate' : 'endDate',
            message: 'Date parameter is required'
          }]
        });
      }
      
      // Build date filter
      if (startDate || endDate) {
        if (Array.isArray(fieldName)) {
          // Multiple fields - use $or condition
          const { buildMultiFieldDateFilter } = require('../utils/dateFilter');
          const dateFilter = buildMultiFieldDateFilter(startDate, endDate, fieldName);
          req.dateFilter = dateFilter;
        } else {
          // Single field
          const dateFilter = buildDateRangeFilter(startDate, endDate, fieldName);
          req.dateFilter = dateFilter;
        }
        
        // Also store parsed dates for reference
        req.dateRange = { startDate, endDate };
      } else {
        req.dateFilter = {};
        req.dateRange = { startDate: null, endDate: null };
      }
      
      next();
    } catch (error) {
      return res.status(400).json({
        message: 'Invalid date parameters',
        error: error.message
      });
    }
  };
};

/**
 * Middleware to merge date filter with existing query filter
 * @param {Object} existingFilter - Existing MongoDB filter object
 * @param {string|Array<string>} fieldName - MongoDB field name(s) to filter on
 * @returns {Function} Express middleware function
 */
const mergeDateFilter = (existingFilter = {}, fieldName = 'createdAt') => {
  return (req, res, next) => {
    try {
      const { startDate, endDate } = parseDateParams(req.query);
      
      if (startDate || endDate) {
        let dateFilter;
        
        if (Array.isArray(fieldName)) {
          const { buildMultiFieldDateFilter } = require('../utils/dateFilter');
          dateFilter = buildMultiFieldDateFilter(startDate, endDate, fieldName);
        } else {
          dateFilter = buildDateRangeFilter(startDate, endDate, fieldName);
        }
        
        // Merge with existing filter
        req.queryFilter = { ...existingFilter, ...dateFilter };
      } else {
        req.queryFilter = existingFilter;
      }
      
      next();
    } catch (error) {
      return res.status(400).json({
        message: 'Invalid date parameters',
        error: error.message
      });
    }
  };
};

module.exports = {
  validateDateParams,
  processDateFilter,
  mergeDateFilter
};
