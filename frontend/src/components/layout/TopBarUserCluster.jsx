import React, { memo, useMemo } from 'react';
import {
  Settings,
  LogOut,
  HelpCircle,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import OnlineAvatarStack from '../OnlineAvatarStack';
import { OnlineStatusDot } from '../OnlineStatusDot';
import { useGetOnlineUsersQuery } from '../../store/services/presenceApi';
import { POLLING_INTERVALS } from '../../config/polling';
import { getRoleLabel } from '../../utils/roleLabels';
import {
  getUserInitials,
  getAvatarColorClass,
  formatAlertCount,
  getUserPrimaryLabel,
  getUserSecondaryEmail,
  isUserInOnlineList,
} from '../../utils/userDisplay';
import { cn } from '@/lib/utils';

const Divider = () => (
  <div className="hidden sm:block h-5 w-px bg-gray-200" aria-hidden />
);

export const InventoryAlertsButton = memo(function InventoryAlertsButton({
  count,
  onClick,
  title,
}) {
  const label = formatAlertCount(count);

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors',
        'hover:bg-amber-50 hover:text-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40'
      )}
    >
      <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={2} />
      {label && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none shadow-sm ring-2 ring-white">
          {label}
        </span>
      )}
    </button>
  );
});

export const UserAvatar = memo(function UserAvatar({
  user,
  size = 'md',
  showOnline = false,
  className = '',
}) {
  const initials = getUserInitials(user);
  const colorClass = getAvatarColorClass(user?.id || user?.email || initials);
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-9 w-9 text-xs';

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm',
        sizeClass,
        colorClass,
        className
      )}
    >
      {initials}
      {showOnline && <OnlineStatusDot className="h-3 w-3" />}
    </span>
  );
});

export const TopBarUserCluster = memo(function TopBarUserCluster({
  user,
  userMenuOpen,
  onToggleUserMenu,
  onNavigateSettings,
  onNavigateHelp,
  onLogout,
  isLoggingOut,
  canManageSettings,
  alertCount = 0,
  alertTitle = 'Inventory alerts',
  onAlertClick,
  showAlerts = true,
  showTeamPresence = true,
  userMenuRef,
}) {
  const roleLabel = getRoleLabel(user?.role);
  const primaryLabel = getUserPrimaryLabel(user);
  const secondaryEmail = getUserSecondaryEmail(user);
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const { data: onlineData } = useGetOnlineUsersQuery(undefined, {
    pollingInterval: POLLING_INTERVALS.ONLINE_USERS_MS,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    skip: !user || !isAdmin,
  });
  const onlineUsers = useMemo(() => {
    const list = onlineData?.data ?? onlineData ?? [];
    return Array.isArray(list) ? list : [];
  }, [onlineData]);
  const isCurrentUserOnline = useMemo(
    () => (isAdmin ? isUserInOnlineList(user, onlineUsers) : Boolean(user)),
    [isAdmin, user, onlineUsers]
  );
  const teamOnlineCount = useMemo(
    () =>
      onlineUsers.filter((entry) => {
        const uid = String(entry.userId ?? entry.id ?? '');
        const selfId = String(user?.id ?? user?._id ?? '');
        return !selfId || uid !== selfId;
      }).length,
    [onlineUsers, user?.id, user?._id]
  );
  const showTeamStack = showTeamPresence && teamOnlineCount > 0;

  return (
    <div
      ref={userMenuRef}
      className="relative ml-auto flex shrink-0 items-center"
    >
      <div className="flex items-center gap-0 rounded-lg border border-gray-200/90 bg-white py-0.5 pl-0.5 pr-0 shadow-sm">
        {showTeamStack && (
          <>
            <div className="hidden min-[1100px]:flex items-center pl-0.5">
              <OnlineAvatarStack compact excludeSelf />
            </div>
            <Divider />
          </>
        )}

        {showAlerts && (
          <>
            <InventoryAlertsButton
              count={alertCount}
              onClick={onAlertClick}
              title={alertTitle}
            />
            <Divider />
          </>
        )}

        <button
          type="button"
          onClick={onToggleUserMenu}
          aria-expanded={userMenuOpen}
          aria-haspopup="menu"
          className={cn(
            'flex items-center gap-1.5 rounded-md pl-0.5 pr-1 py-0.5 transition-colors',
            'hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10',
            userMenuOpen && 'bg-gray-50'
          )}
          title={`${primaryLabel} — ${roleLabel}`}
        >
          <UserAvatar user={user} showOnline={isCurrentUserOnline} size="sm" />
          <span className="hidden md:flex flex-col items-start min-w-0 max-w-[140px] lg:max-w-[180px]">
            <span className="text-sm font-semibold text-gray-900 truncate w-full text-left leading-tight">
              {primaryLabel}
            </span>
            <span className="mt-0.5 inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
              {roleLabel}
            </span>
          </span>
          <ChevronDown
            className={cn(
              'hidden sm:block h-4 w-4 text-gray-400 transition-transform duration-200',
              userMenuOpen && 'rotate-180'
            )}
          />
        </button>
      </div>

      {userMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-[60] w-64 overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-xl ring-1 ring-black/5"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/80 px-4 py-3">
            <UserAvatar user={user} showOnline={isCurrentUserOnline} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{primaryLabel}</p>
              {secondaryEmail ? (
                <p className="truncate text-xs text-gray-500">{secondaryEmail}</p>
              ) : null}
              <span className="mt-1 inline-flex rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 ring-1 ring-gray-200">
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="p-1.5">
            {canManageSettings && (
              <button
                type="button"
                role="menuitem"
                onClick={onNavigateSettings}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
              >
                <Settings className="h-4 w-4 text-gray-400" />
                Settings
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={onNavigateHelp}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              <HelpCircle className="h-4 w-4 text-gray-400" />
              Help
            </button>
            <div className="my-1 h-px bg-gray-100" />
            <button
              type="button"
              role="menuitem"
              onClick={onLogout}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default TopBarUserCluster;
