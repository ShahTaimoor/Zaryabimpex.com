const { formatText } = require('./textFormat');

/**
 * Apply the global text-formatting mode (configured in Settings) to a string.
 * Whitespace is normalized first, then the active case style is applied.
 *
 * "led perfomaxe" / "SHAH AUTO STORE" / "the quick brown fox" → output depends
 * on the mode selected under Settings → Text Formatting:
 *   - capitalize (default): "Led Perfomaxe"
 *   - uppercase:             "LED PERFOMAXE"
 *   - lowercase:             "led perfomaxe"
 *   - sentence:              "Led perfomaxe"
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function toTitleCase(value) {
  if (value == null || typeof value !== 'string') return value;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;
  return formatText(trimmed);
}

module.exports = { toTitleCase };
