const { formatResponseBody } = require('../utils/entityTextFormat');

/**
 * Format API JSON responses to Title Case for display consistency.
 */
function formatTextResponse(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function formatAndSend(body) {
    try {
      if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
        body = formatResponseBody(body);
      }
    } catch (err) {
      console.warn('formatTextResponse skipped:', err.message);
    }
    return originalJson(body);
  };
  next();
}

module.exports = { formatTextResponse };
