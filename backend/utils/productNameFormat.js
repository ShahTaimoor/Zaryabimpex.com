const { toTitleCase } = require('./titleCase');

/**
 * Uppercase only text inside parentheses in a product name.
 *
 * @example formatProductNameBrackets('Led Light (grp4040)') => 'Led Light (GRP4040)'
 */
function formatProductNameBrackets(value) {
  if (value == null) return value;
  if (typeof value !== 'string') return value;
  return value.replace(/\(([^)]*)\)/g, (_, inner) => `(${inner.toUpperCase()})`);
}

/** Title Case product name; codes inside parentheses stay uppercase. */
function formatProductDisplayName(value) {
  if (value == null) return value;
  if (typeof value !== 'string') return value;
  return formatProductNameBrackets(toTitleCase(value));
}

module.exports = { formatProductNameBrackets, formatProductDisplayName };
