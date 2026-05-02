/**
 * In-memory presence map (single Node process). Users are considered online
 * if their last heartbeat is within ONLINE_TTL_MS.
 *
 * Use a generous TTL: background browser tabs throttle setInterval heavily (often
 * to ~1/min or pause timers), so short TTLs falsely mark active users offline.
 */
const ONLINE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** @type {Map<string, { userId: string|number, fullName: string, role: string, lastSeen: number, tabId?: string|null }>} */
const sessions = new Map();

function prune() {
  const now = Date.now();
  for (const [id, rec] of sessions) {
    if (now - rec.lastSeen > ONLINE_TTL_MS) {
      sessions.delete(id);
    }
  }
}

function heartbeat(user, meta = {}) {
  if (!user?.id) return;
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email ||
    'User';
  const id = String(user.id);
  sessions.set(id, {
    userId: user.id,
    fullName,
    role: user.role || 'user',
    lastSeen: Date.now(),
    tabId: meta.tabId || null,
  });
}

function getOnline() {
  prune();
  const now = Date.now();
  return [...sessions.values()]
    .filter((v) => now - v.lastSeen <= ONLINE_TTL_MS)
    .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), undefined, { sensitivity: 'base' }));
}

module.exports = {
  heartbeat,
  getOnline,
  ONLINE_TTL_MS,
};
