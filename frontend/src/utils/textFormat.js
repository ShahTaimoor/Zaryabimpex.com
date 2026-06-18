/**
 * Centralized global text-formatting utility for the frontend.
 *
 * Mirrors the backend's textFormat.js. The active mode is loaded from the
 * company settings (textFormatSettings.mode) and applied via toTitleCase()
 * which is already used across the entire frontend.
 *
 * Modes:
 *   - 'capitalize'  → Capitalize Each Word   (default / historical Title Case)
 *   - 'uppercase'   → UPPERCASE
 *   - 'lowercase'   → lowercase
 *   - 'sentence'    → Sentence case
 */

const VALID_MODES = ['capitalize', 'uppercase', 'lowercase', 'sentence'];
const DEFAULT_MODE = 'capitalize';

// In-memory cache – kept in sync by the useTextFormatMode hook (or manual setFormatMode).
let activeMode = DEFAULT_MODE;

export const TEXT_FORMAT_MODES = VALID_MODES;
export const TEXT_FORMAT_DEFAULT = DEFAULT_MODE;

export function normalizeMode(mode) {
  if (typeof mode === 'string' && VALID_MODES.includes(mode.toLowerCase())) {
    return mode.toLowerCase();
  }
  return DEFAULT_MODE;
}

export function setFormatMode(mode) {
  activeMode = normalizeMode(mode);
}

export function getFormatMode() {
  return activeMode;
}

// ---- Individual case transformers ----

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
  const lowered = value.toLowerCase();
  const match = lowered.match(/^(\s*)(\S)/);
  if (!match) return lowered;
  return match[1] + match[2].toUpperCase() + lowered.slice(match[0].length);
}

/**
 * Apply the active format mode to a whitespace-normalized string.
 */
export function formatText(value) {
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
