/**
 * Utilities for normalising the `pagination` payload returned by paginated
 * list endpoints.
 *
 * The backend sometimes wraps its response in `{ data: { pagination } }`
 * (RTK Query default) and sometimes returns `{ pagination }` directly.
 * Pages had identical inline expressions like:
 *
 *   const paginationInfo =
 *     bankReceiptsData?.data?.pagination ||
 *     bankReceiptsData?.pagination ||
 *     {};
 *
 * `getPaginationInfo()` centralises that fallback logic.
 */

/**
 * Resolve the pagination object from either response shape.
 * Always returns an object so callers can safely read `.totalItems`,
 * `.totalPages`, etc.
 *
 * @param {object | null | undefined} responseData
 * @returns {{ totalItems?: number, totalPages?: number, page?: number, limit?: number }}
 */
export function getPaginationInfo(responseData) {
  if (!responseData || typeof responseData !== 'object') return {};
  return responseData?.data?.pagination || responseData?.pagination || {};
}

export default getPaginationInfo;
