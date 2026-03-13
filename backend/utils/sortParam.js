/**
 * Normalize sort parameter to "field direction" string for PostgreSQL ORDER BY.
 * Express may parse query like ?sort[field]=name&sort[dir]=asc as an object,
 * and .split() on that causes "sort.split is not a function".
 * Also supports MongoDB-style objects like { name: 1 } or { createdAt: -1 }.
 *
 * @param {string|object|array|null|undefined} sort - Raw sort from options
 * @param {string} defaultSort - e.g. 'created_at DESC'
 * @returns {string} - e.g. 'created_at DESC'
 */
function toSortString(sort, defaultSort) {
  if (typeof sort === 'string' && sort.trim()) return sort.trim();
  if (sort && typeof sort === 'object' && !Array.isArray(sort)) {
    const keys = Object.keys(sort);
    const field = sort.field ?? sort.column;
    const dir = String(sort.order ?? sort.dir ?? 'asc').toUpperCase();
    if (field) return `${field} ${dir === 'DESC' ? 'DESC' : 'ASC'}`;
    // MongoDB-style: { name: 1 } or { createdAt: -1 }
    if (keys.length >= 1) {
      const firstKey = keys[0];
      const val = sort[firstKey];
      const direction = (typeof val === 'number' && val < 0) ? 'DESC' : 'ASC';
      return `${firstKey} ${direction}`;
    }
  }
  if (Array.isArray(sort) && sort.length >= 1) {
    const dir = (sort[1] || 'ASC').toString().toUpperCase();
    return `${sort[0]} ${dir === 'DESC' ? 'DESC' : 'ASC'}`;
  }
  return defaultSort;
}

module.exports = { toSortString };
