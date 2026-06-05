const { splitSearchTokens } = require('./searchTokens');

/**
 * Build AND-style ILIKE clauses (each token must match at least one column).
 */
function buildTokenizedIlikeClause(columns, search, startParamIndex = 1) {
  const tokens = splitSearchTokens(search);
  if (tokens.length === 0) {
    return { clause: '', params: [], nextParamIndex: startParamIndex };
  }

  let clause = '';
  const params = [];
  let paramIndex = startParamIndex;

  for (const token of tokens) {
    const orParts = columns.map((col) => `${col} ILIKE $${paramIndex}`);
    clause += ` AND (${orParts.join(' OR ')})`;
    params.push(`%${token}%`);
    paramIndex += 1;
  }

  return { clause, params, nextParamIndex: paramIndex };
}

/**
 * Single-term ILIKE across multiple columns (OR).
 */
function buildSimpleIlikeClause(columns, search, startParamIndex = 1) {
  const term = String(search ?? '').trim();
  if (!term) {
    return { clause: '', params: [], nextParamIndex: startParamIndex };
  }
  const orParts = columns.map((col) => `${col} ILIKE $${startParamIndex}`);
  return {
    clause: ` AND (${orParts.join(' OR ')})`,
    params: [`%${term}%`],
    nextParamIndex: startParamIndex + 1,
  };
}

module.exports = {
  buildTokenizedIlikeClause,
  buildSimpleIlikeClause,
};
