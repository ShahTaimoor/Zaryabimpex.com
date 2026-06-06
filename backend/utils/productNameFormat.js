/**
 * Uppercase only text inside parentheses in a product name.
 * The main name text is preserved exactly as entered.
 *
 * @example formatProductNameBrackets('LED light (grp4040)') => 'LED light (GRP4040)'
 * @example formatProductNameBrackets('widget (abc123) XL') => 'widget (ABC123) XL'
 * @param {unknown} value
 * @returns {unknown}
 */
function formatProductNameBrackets(value) {
  if (value == null) return value;
  if (typeof value !== 'string') return value;
  return value.replace(/\(([^)]*)\)/g, (_, inner) => `(${inner.toUpperCase()})`);
}

module.exports = { formatProductNameBrackets };
