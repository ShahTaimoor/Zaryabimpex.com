const { createRateLimiter } = require('./rateLimit');
const validator = require('validator');
const AuditLog = require('../models/AuditLog');

/**
 * Security Middleware
 * Provides security hardening and access control
 */
class SecurityMiddleware {
  /**
   * Rate limiter for API endpoints
   */
  createRateLimiterWrapper(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100, // 100 requests per window
      message = 'Too many requests from this IP, please try again later.'
    } = options;
    
    return createRateLimiter({
      windowMs,
      max,
      keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'global'
    });
  }
  
  /**
   * Financial operations rate limiter (stricter)
   */
  financialRateLimiter() {
    return this.createRateLimiterWrapper({
      windowMs: 15 * 60 * 1000,
      max: 50, // Lower limit for financial operations
      message: 'Too many financial operations. Please try again later.'
    });
  }
  
  /**
   * Input sanitization middleware
   */
  sanitizeInput(req, res, next) {
    if (req.body) {
      req.body = this.sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = this.sanitizeObject(req.query);
    }
    if (req.params) {
      req.params = this.sanitizeObject(req.params);
    }
    next();
  }
  
  /**
   * Recursively sanitize object
   */
  sanitizeObject(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'string') {
      // Escape HTML and remove potential script tags
      return validator.escape(validator.stripLow(obj));
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // Sanitize key
          const sanitizedKey = validator.escape(key);
          sanitized[sanitizedKey] = this.sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    
    return obj;
  }
  
  /**
   * Require financial permission middleware
   */
  requireFinancialPermission(requiredPermission) {
    return async (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          message: 'Authentication required'
        });
      }
      
      // Check if user has required permission
      const userPermissions = req.user.permissions || [];
      
      if (!userPermissions.includes(requiredPermission) && 
          !userPermissions.includes('admin') &&
          !userPermissions.includes('super_admin')) {
        // Log unauthorized access attempt
        try {
          await AuditLog.create({
            user: req.user._id,
            action: 'unauthorized_access_attempt',
            documentType: 'financial_operation',
            description: `Attempted ${req.method} ${req.path} without permission: ${requiredPermission}`,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            timestamp: new Date()
          });
        } catch (error) {
          console.error('Error logging unauthorized access:', error);
        }
        
        return res.status(403).json({
          message: 'Insufficient permissions for this operation',
          required: requiredPermission,
          hasPermissions: userPermissions
        });
      }
      
      next();
    };
  }
  
  /**
   * Audit financial operations middleware
   */
  auditFinancialOperation() {
    return async (req, res, next) => {
      const originalSend = res.send.bind(res);
      const startTime = Date.now();
      
      res.send = function(data) {
        const duration = Date.now() - startTime;
        
        // Check if this is a financial operation
        const isFinancial = req.route?.isFinancial || 
                           req.path?.includes('/sales') ||
                           req.path?.includes('/purchase') ||
                           req.path?.includes('/journal') ||
                           req.path?.includes('/pl-statements') ||
                           req.path?.includes('/balance-sheets') ||
                           req.path?.includes('/transactions') ||
                           req.path?.includes('/customers') && (req.method === 'POST' || req.method === 'PUT');
        
        if (isFinancial && req.user) {
          // Log financial operation asynchronously (don't block response)
          AuditLog.create({
            user: req.user._id,
            action: `${req.method} ${req.path}`,
            documentType: 'financial_operation',
            description: `Financial operation: ${req.method} ${req.path}`,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('user-agent'),
            requestBody: this.sanitizeForLogging(req.body),
            responseStatus: res.statusCode,
            duration,
            timestamp: new Date()
          }).catch(error => {
            console.error('Error logging financial operation:', error);
          });
        }
        
        originalSend.call(this, data);
      };
      
      next();
    };
  }
  
  /**
   * Sanitize sensitive data for logging
   */
  sanitizeForLogging(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'cvv'];
    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Validate MongoDB ObjectId
   */
  validateObjectId(id, fieldName = 'id') {
    if (!id) {
      throw new Error(`${fieldName} is required`);
    }
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid ${fieldName}: ${id}`);
    }
    
    return true;
  }
  
  /**
   * Validate numeric amounts
   */
  validateAmount(amount, fieldName = 'amount', allowNegative = false) {
    if (amount === undefined || amount === null) {
      throw new Error(`${fieldName} is required`);
    }
    
    const numAmount = Number(amount);
    if (isNaN(numAmount)) {
      throw new Error(`${fieldName} must be a valid number`);
    }
    
    if (!allowNegative && numAmount < 0) {
      throw new Error(`${fieldName} cannot be negative`);
    }
    
    // Check for reasonable limits (prevent overflow)
    if (Math.abs(numAmount) > 999999999) {
      throw new Error(`${fieldName} exceeds maximum allowed value`);
    }
    
    return numAmount;
  }
  
  /**
   * Prevent SQL injection (for MongoDB, but good practice)
   */
  preventInjection(input) {
    if (typeof input === 'string') {
      // Remove potentially dangerous characters
      return input.replace(/[;$'"]/g, '');
    }
    return input;
  }
  
  /**
   * Validate date range
   */
  validateDateRange(startDate, endDate) {
    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime())) {
      throw new Error('Invalid start date');
    }
    
    if (isNaN(end.getTime())) {
      throw new Error('Invalid end date');
    }
    
    if (start > end) {
      throw new Error('Start date cannot be after end date');
    }
    
    // Check reasonable date range (not more than 10 years)
    const maxRange = 10 * 365 * 24 * 60 * 60 * 1000; // 10 years in milliseconds
    if (end - start > maxRange) {
      throw new Error('Date range cannot exceed 10 years');
    }
    
    return { start, end };
  }
}

module.exports = new SecurityMiddleware();

