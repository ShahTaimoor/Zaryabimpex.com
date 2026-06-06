'use strict';

/**
 * Normalize product search phrases for flexible matching (spacing, x notation, case).
 * Examples:
 *   "125x"     -> "125 x"
 *   "125 x2.5" -> "125 x 2.5"
 *   "12 x3"    -> "12 x 3"
 */

function collapseSpaces(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeSearchPhrase(raw) {
  let s = collapseSpaces(raw).toLowerCase();
  if (!s) return '';

  // 125x2.5 / 125x / 125X -> spaced form
  s = s.replace(/(\d+)\s*([x×])\s*(\d*\.?\d*)/gi, (_, num, _x, rest) => {
    const r = String(rest ?? '').trim();
    return r ? `${num} x ${r}` : `${num} x`;
  });

  // x3 / x 2.5 at start or after space
  s = s.replace(/(^|\s)([x×])\s*(\d*\.?\d*)/gi, (_, pre, _x, rest) => {
    const r = String(rest ?? '').trim();
    return r ? `${pre}x ${r}` : `${pre}x`;
  });

  return collapseSpaces(s);
}

/** Alphanumeric-only compact form for ignoring spaces/punctuation in names. */
function compactSearchPhrase(raw) {
  return normalizeSearchPhrase(raw).replace(/[^a-z0-9]/g, '');
}

/**
 * Variants for one token (OR within token, AND across tokens in search builder).
 */
function expandTokenVariants(token) {
  const original = collapseSpaces(token);
  if (!original) return [];

  const seen = new Set();
  const out = [];
  const add = (v) => {
    const t = collapseSpaces(v);
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  add(original);
  add(normalizeSearchPhrase(original));

  const compact = compactSearchPhrase(original);
  if (compact) add(compact);

  const dim = original.match(/^(\d+(?:\.\d+)?)\s*([x×])\s*(\d*\.?\d*)$/i);
  if (dim) {
    add(dim[1]);
    if (dim[3]) add(dim[3]);
    add(`${dim[1]} x ${dim[3] || ''}`.trim());
    add(`${dim[1]}x${dim[3] || ''}`);
  }

  const glued = original.match(/^(\d+)([x×])(\d*\.?\d*)$/i);
  if (glued) {
    add(glued[1]);
    if (glued[3]) add(glued[3]);
    add(`${glued[1]} x ${glued[3] || ''}`.trim());
  }

  const xLead = original.match(/^([x×])(\d*\.?\d+)$/i);
  if (xLead) {
    add(xLead[2]);
    add(`x ${xLead[2]}`);
    add(`x${xLead[2]}`);
  }

  return out;
}

/**
 * Split user query into AND tokens with flexible dimension notation expansion.
 */
function expandProductSearchTokens(raw) {
  const input = collapseSpaces(raw);
  if (!input) return [];

  const normalized = normalizeSearchPhrase(input);
  const baseParts = [
    ...input.split(/\s+/),
    ...normalized.split(/\s+/),
    ...input.replace(/[\/&*]+/g, ' ').split(/\s+/),
  ].filter(Boolean);

  const seen = new Set();
  const tokens = [];
  for (const part of baseParts) {
    const key = part.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tokens.push(part);
    }
  }

  // Single glued query without spaces: "125x2.5"
  if (tokens.length === 1) {
    const only = tokens[0];
    if (/^\d+[x×]/i.test(only) || /^[x×]\d/i.test(only)) {
      const norm = normalizeSearchPhrase(only);
      for (const p of norm.split(/\s+/).filter(Boolean)) {
        const k = p.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          tokens.push(p);
        }
      }
    }
  }

  return tokens;
}

/** SQL expression: compact normalized product name for flexible matching. */
const SQL_PRODUCT_NAME_COMPACT = `regexp_replace(
  regexp_replace(lower(trim(COALESCE(name, ''))), '\\s+', ' ', 'g'),
  '[^a-z0-9]', '', 'g'
)`;

const SQL_VARIANT_DISPLAY_COMPACT = `regexp_replace(
  regexp_replace(lower(trim(COALESCE(display_name, variant_name, ''))), '\\s+', ' ', 'g'),
  '[^a-z0-9]', '', 'g'
)`;

module.exports = {
  collapseSpaces,
  normalizeSearchPhrase,
  compactSearchPhrase,
  expandTokenVariants,
  expandProductSearchTokens,
  SQL_PRODUCT_NAME_COMPACT,
  SQL_VARIANT_DISPLAY_COMPACT,
};
