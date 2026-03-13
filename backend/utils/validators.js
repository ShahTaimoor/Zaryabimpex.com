/**
 * Shared validators for PostgreSQL (UUID) IDs.
 * Use these instead of isMongoId() for all entity IDs.
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUUID(value) {
  if (value == null || typeof value !== 'string') return false;
  return UUID_V4_REGEX.test(value.trim());
}

/**
 * express-validator chain helper: validates UUID (optional field).
 * Usage: body('customerId').optional({ checkFalsy: true }).custom(isId).withMessage('Invalid ID')
 */
function isId(value) {
  if (value == null || value === '') return true;
  return isUUID(value) ? true : Promise.reject(new Error('Must be a valid UUID'));
}

/**
 * express-validator chain helper: validates required UUID.
 */
function isIdRequired(value) {
  if (value == null || value === '') return Promise.reject(new Error('ID is required'));
  return isUUID(value) ? true : Promise.reject(new Error('Must be a valid UUID'));
}

module.exports = {
  isUUID,
  isId,
  isIdRequired,
  UUID_V4_REGEX
};
