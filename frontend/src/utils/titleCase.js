import { formatText } from './textFormat';

/**
 * Apply the global text-formatting mode (configured in Settings) to a string.
 * Whitespace is normalized first, then the active case style is applied.
 * This is the main export used by partyDisplay, formatters, and pages.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function toTitleCase(value) {
  if (value == null) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;
  return formatText(trimmed);
}
