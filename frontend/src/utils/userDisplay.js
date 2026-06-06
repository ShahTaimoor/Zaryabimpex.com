export function getOnlineUserId(entry) {
  if (!entry) return '';
  return String(entry.userId ?? entry.id ?? entry._id ?? '');
}

export function isUserInOnlineList(user, onlineList) {
  if (!user || !Array.isArray(onlineList)) return false;
  const selfId = getOnlineUserId(user);
  if (!selfId) return false;
  return onlineList.some((entry) => getOnlineUserId(entry) === selfId);
}

export function getUserPrimaryLabel(user) {
  const fullName = String(user?.fullName || '').trim();
  if (fullName) return fullName;
  return user?.email || 'User';
}

export function getUserSecondaryEmail(user) {
  const fullName = String(user?.fullName || '').trim();
  const email = String(user?.email || '').trim();
  if (!fullName || !email || fullName === email) return null;
  return email;
}

export function getUserInitials(user) {
  const fullName = String(user?.fullName || '').trim();
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  }

  const email = String(user?.email || '').trim();
  if (email) return email.slice(0, 2).toUpperCase();

  return 'U';
}

export function getAvatarColorClass() {
  return 'bg-black';
}

export function formatAlertCount(count) {
  const value = Number(count) || 0;
  if (value <= 0) return null;
  if (value > 99) return '99+';
  return String(value);
}
