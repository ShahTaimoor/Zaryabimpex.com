/**
 * Shared display formatting for API responses (Title Case).
 * Replaces legacy per-route UPPERCASE transforms.
 */
const {
  formatCustomerEntity,
  formatSupplierEntity,
  formatProductEntity,
  formatResponseBody,
  toTitleCase,
} = require('./entityTextFormat');

module.exports = {
  formatCustomerEntity,
  formatSupplierEntity,
  formatProductEntity,
  formatResponseBody,
  toTitleCase,
  transformCustomerToTitleCase: formatCustomerEntity,
  transformProductToTitleCase: formatProductEntity,
  transformSupplierToTitleCase: formatSupplierEntity,
  /** @deprecated Use Title Case formatters — kept for existing route imports */
  transformCustomerToUppercase: formatCustomerEntity,
  transformProductToUppercase: formatProductEntity,
  transformSupplierToUppercase: formatSupplierEntity,
};
