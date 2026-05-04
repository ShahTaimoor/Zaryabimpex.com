/**
 * Split a user search string into tokens for AND-style matching (each token
 * may appear anywhere in the name, not necessarily as one contiguous substring).
 * @param {string} raw
 * @returns {string[]}
 */
function splitSearchTokens(raw) {
  return String(raw ?? '')
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

module.exports = { splitSearchTokens };
