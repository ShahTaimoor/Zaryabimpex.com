/**
 * Tiny in-memory TTL cache for expensive read-mostly handlers (e.g. reports).
 * Not shared across processes; safe for single-node deployments.
 */

const store = new Map();

function now() {
  return Date.now();
}

/**
 * @param {string} key
 * @param {number} ttlMs
 * @param {() => Promise<any>} factory
 * @returns {Promise<any>}
 */
async function getCached(key, ttlMs, factory) {
  const t = now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > t) {
    return hit.value;
  }
  const value = await factory();
  store.set(key, { value, expiresAt: t + Math.max(1000, ttlMs) });
  return value;
}

/** Best-effort cap to avoid unbounded growth */
const MAX_KEYS = 500;

function pruneIfNeeded() {
  if (store.size <= MAX_KEYS) return;
  const cutoff = now();
  for (const [k, v] of store) {
    if (v.expiresAt <= cutoff) store.delete(k);
  }
  if (store.size <= MAX_KEYS) return;
  const keys = [...store.keys()].slice(0, Math.floor(store.size / 2));
  keys.forEach((k) => store.delete(k));
}

setInterval(() => {
  try {
    pruneIfNeeded();
  } catch (_) {
    /* ignore */
  }
}, 60_000).unref?.();

module.exports = { getCached };
