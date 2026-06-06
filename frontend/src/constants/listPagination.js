/** Default page size for list/search pages (matches backend listQuery default). */
export const DEFAULT_LIST_LIMIT = 50;

/** Max product rows in POS / picker dropdowns (search and first-click browse). */
export const PRODUCT_SEARCH_DROPDOWN_LIMIT = 20;

/** @deprecated Use PRODUCT_SEARCH_DROPDOWN_LIMIT — browse on focus uses the same cap. */
export const PRODUCT_BROWSE_DROPDOWN_LIMIT = PRODUCT_SEARCH_DROPDOWN_LIMIT;
