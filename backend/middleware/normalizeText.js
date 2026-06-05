const { normalizeRequestBodyByPath } = require('../utils/entityTextFormat');

/**
 * Normalize incoming text fields to Title Case before route handlers (PostgreSQL storage).
 */
function normalizeTextRequest(req, res, next) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
  if (!req.body || typeof req.body !== 'object') return next();

  const path = `${req.baseUrl || ''}${req.path || ''}`;
  req.body = normalizeRequestBodyByPath(path, req.body);
  next();
}

module.exports = { normalizeTextRequest };
