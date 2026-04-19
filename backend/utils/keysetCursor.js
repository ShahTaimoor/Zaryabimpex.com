const crypto = require('crypto');

/**
 * Encode (created_at, id) for keyset pagination (DESC: next page is "older" rows).
 * @param {Date|string} createdAt
 * @param {string} id - uuid
 */
function encodeCursor(createdAt, id) {
  const t =
    createdAt instanceof Date
      ? createdAt.toISOString()
      : typeof createdAt === 'string'
        ? createdAt
        : '';
  const payload = JSON.stringify({ t, id: String(id) });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/**
 * @param {string|undefined|null} cursor
 * @returns {{ t: string, id: string } | null}
 */
function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const raw = Buffer.from(cursor.trim(), 'base64url').toString('utf8');
    const o = JSON.parse(raw);
    if (!o || typeof o.t !== 'string' || typeof o.id !== 'string') return null;
    const id = o.id.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return null;
    }
    return { t: o.t, id };
  } catch {
    return null;
  }
}

function hashKeyPart(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex').slice(0, 16);
}

module.exports = { encodeCursor, decodeCursor, hashKeyPart };
