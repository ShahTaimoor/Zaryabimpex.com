/**
 * Convert display text to Title Case.
 * "led perfomaxe" → "Led Perfomaxe", "SHAH AUTO STORE" → "Shah Auto Store"
 * @param {unknown} value
 * @returns {unknown}
 */
function toTitleCase(value) {
  if (value == null) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;
  return trimmed
    .split(' ')
    .map((word) => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

module.exports = { toTitleCase };
