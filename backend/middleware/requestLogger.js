/**
 * Request Logger Middleware
 * Logs all HTTP requests with method, path, status code, and response time
 */

const logger = require('../utils/logger');
const env = process.env.NODE_ENV || 'development';
const NOISY_PATHS = new Set([
  '/api/health',
  '/api/presence/online',
  '/api/presence/heartbeat',
  '/api/inventory-alerts/summary',
]);

const requestLogger = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const path = req.path || req.originalUrl || '';
  const isNoisyPath = NOISY_PATHS.has(path);
  const startTime = Date.now();

  if (!isNoisyPath && env === 'development') {
    logger.http(`${req.method} ${req.path}`, {
      requestId: req.id,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    });
  }

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const isError = res.statusCode >= 500;
    const isWarn = res.statusCode >= 400 && res.statusCode < 500;
    const isSlow = duration >= 1500;
    if (isNoisyPath && !isError && !isSlow) return;

    const logLevel = isError ? 'error' : isWarn ? 'warn' : 'http';
    if (env === 'production' && !isError && !isWarn && !isSlow) return;

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

