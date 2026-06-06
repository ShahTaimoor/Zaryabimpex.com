/**
 * Convert display text to Title Case (mirrors backend/utils/titleCase.js).
 */
export function toTitleCase(value) {
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
