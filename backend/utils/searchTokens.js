const { expandProductSearchTokens } = require('./searchNormalize');

/**
 * Split a user search string into tokens for AND-style matching (each token
 * may appear anywhere in the name, not necessarily as one contiguous substring).
 * @param {string} raw
 * @returns {string[]}
 */
function splitSearchTokens(raw) {
  return expandProductSearchTokens(raw);
}

module.exports = { splitSearchTokens, expandProductSearchTokens };
