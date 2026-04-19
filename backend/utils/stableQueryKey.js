/**
 * Deterministic cache key from a query object (sorted keys, stable JSON).
 */
function stableQueryKey(obj) {
  if (obj == null) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return `[${obj.map((x) => stableQueryKey(x)).join(',')}]`;
  }
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableQueryKey(obj[k])}`);
  return `{${parts.join(',')}}`;
}

module.exports = { stableQueryKey };
