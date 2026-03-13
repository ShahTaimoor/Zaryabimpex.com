/**
 * Request Logger Middleware
 * Logs all HTTP requests with method, path, status code, and response time
 */

const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request
  logger.http(`${req.method} ${req.path}`, {
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    userAgent: req.get('user-agent')
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'error' : res.statusCode >= 300 ? 'warn' : 'http';
    
    logger[logLevel](`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`, {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });
  });

  next();
};

module.exports = requestLogger;

