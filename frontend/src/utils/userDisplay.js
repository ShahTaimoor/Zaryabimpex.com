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
