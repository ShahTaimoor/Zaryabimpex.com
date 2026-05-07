/**
 * Split a user search string into tokens for AND-style matching (each token
 * may appear anywhere in the name, not necessarily as one contiguous substring).
 * @param {string} raw
 * @returns {string[]}
 */
function splitSearchTokens(raw) {
  const input = String(raw ?? '').trim();
  if (!input) return [];

  // Keep the original space-based tokens.
  const baseTokens = input
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Add permissive tokens that ignore common separators so searches like
  // "50 72" can still find "50/72", and "A B" can match "A&B" etc.
  const expandedTokens = input
    .replace(/[\/&*]+/g, ' ')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // De-duplicate while preserving order.
  const seen = new Set();
  const out = [];
  for (const t of [...baseTokens, ...expandedTokens]) {
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

module.exports = { splitSearchTokens };
