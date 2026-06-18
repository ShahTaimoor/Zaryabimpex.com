/**
 * Centralized global text-formatting utility.
 *
 * The entire backend formats display text through this single module. The active
 * "mode" is loaded from Settings (textFormatSettings.mode) and cached in memory,
 * so changing it in the Settings page instantly re-styles every API response and
 * persisted record across Products, Customers, Suppliers, Categories, Brands,
 * Invoices, Reports, Receipts, Payments, and all other text fields.
 *
 * Modes:
 *   - 'capitalize'  → Capitalize Each Word   (Title Case, the historical default)
 *   - 'uppercase'   → UPPERCASE
 *   - 'lowercase'   → lowercase
 *   - 'sentence'    → Sentence case
 */

const VALID_MODES = ['capitalize', 'uppercase', 'lowercase', 'sentence'];
const DEFAULT_MODE = 'capitalize';

// In-memory cache of the active mode. Kept in sync by SettingsRepository on
// read/update so request-time formatting stays synchronous and allocation-free.
let activeMode = DEFAULT_MODE;

function normalizeMode(mode) {
  if (typeof mode === 'string' && VALID_MODES.includes(mode.toLowerCase())) {
    return mode.toLowerCase();
  }
  return DEFAULT_MODE;
}

/** Update the active mode (called by Settings repository). Safe for any input. */
function setFormatMode(mode) {
  activeMode = normalizeMode(mode);
}

function getFormatMode() {
  return activeMode;
}

// ---- Individual case transformers (always operate on a plain string) ----

function capitalizeEachWord(value) {
  if (!value) return value;
  return value
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

function toUpperCase(value) {
  return value ? value.toUpperCase() : value;
}

function toLowerCase(value) {
  return value ? value.toLowerCase() : value;
}

function sentenceCase(value) {
  if (!value) return value;
  // Lowercase everything, then uppercase the first non-space character.
  const lowered = value.toLowerCase();
  const match = lowered.match(/^(\s*)(\S)/);
  if (!match) return lowered;
  return match[1] + match[2].toUpperCase() + lowered.slice(match[0].length);
}

/**
 * Apply the active format mode to a plain (already whitespace-normalized) string.
 * Non-string / nullish input is returned unchanged.
 */
function formatText(value) {
  if (value == null || typeof value !== 'string') return value;
  if (!value) return value;
  switch (activeMode) {
    case 'uppercase':
      return toUpperCase(value);
    case 'lowercase':
      return toLowerCase(value);
    case 'sentence':
      return sentenceCase(value);
    case 'capitalize':
    default:
      return capitalizeEachWord(value);
  }
}

module.exports = {
  VALID_MODES,
  DEFAULT_MODE,
  normalizeMode,
  setFormatMode,
  getFormatMode,
  formatText,
  // Expose raw transformers for callers that want a specific case explicitly.
  capitalizeEachWord,
  toUpperCase,
  toLowerCase,
  sentenceCase,
  // Back-compat alias used historically across the codebase.
  toTitleCase: formatText,
};
