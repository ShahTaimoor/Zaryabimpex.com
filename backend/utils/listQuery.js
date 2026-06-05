/** Default page size for list/search APIs (page 1 → limit 50, offset 0). */
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 10000;

/**
 * Parse standard list query params shared by products, customers, suppliers, etc.
 */
function parseListQuery(queryParams = {}, options = {}) {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIST_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_LIST_LIMIT;

  const rawSearch = queryParams.search;
  const search =
    rawSearch != null && String(rawSearch).trim() !== '' ? String(rawSearch).trim() : undefined;

  const getAll =
    queryParams.all === 'true' ||
    queryParams.all === true ||
    (queryParams.limit && parseInt(queryParams.limit, 10) >= 999999);

  const page = getAll ? 1 : Math.max(1, parseInt(queryParams.page, 10) || 1);

  const requestedLimit = parseInt(queryParams.limit, 10);
  const hasExplicitLimit =
    queryParams.limit != null &&
    String(queryParams.limit).trim() !== '' &&
    Number.isFinite(requestedLimit) &&
    requestedLimit > 0;

  let limit;
  if (getAll) {
    limit = Math.min(hasExplicitLimit ? requestedLimit : maxLimit, maxLimit);
  } else if (hasExplicitLimit) {
    limit = Math.min(requestedLimit, maxLimit);
  } else {
    limit = defaultLimit;
  }

  if (!Number.isFinite(limit) || limit < 1) {
    limit = defaultLimit;
  }

  const offset = (page - 1) * limit;

  return { search, page, limit, offset, getAll };
}

/**
 * Standard pagination metadata for offset-based lists.
 */
function buildPaginationMeta({ page, limit, total, nextCursor = null, mode = 'offset' }) {
  const safeTotal = Math.max(0, parseInt(total, 10) || 0);
  const pages = Math.max(1, Math.ceil(safeTotal / limit) || 1);
  return {
    page,
    current: page,
    limit,
    total: safeTotal,
    pages,
    hasMore: page < pages,
    hasNext: page < pages,
    hasPrev: page > 1,
    mode,
    nextCursor: nextCursor ?? null,
  };
}

module.exports = {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  parseListQuery,
  buildPaginationMeta,
};
