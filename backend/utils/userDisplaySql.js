/**
 * SQL expression for a user's display name (first + last, fallback to email).
 * @param {string} alias - users table alias, e.g. 'u'
 */
function userDisplayNameSql(alias = 'u') {
  return `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.last_name)), ''), ${alias}.email)`;
}

module.exports = { userDisplayNameSql };
