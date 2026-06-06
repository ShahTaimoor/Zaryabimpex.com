import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useGetOnlineUsersQuery } from '../store/services/presenceApi';
import { getRoleLabel } from '../utils/roleLabels';
import { getUserInitials, getAvatarColorClass } from '../utils/userDisplay';
import { OnlineStatusDot } from './OnlineStatusDot';
import { cn } from '@/lib/utils';
import { POLLING_INTERVALS } from '../config/polling';

const MAX_VISIBLE = 4;

export default function OnlineAvatarStack({
  className = '',
  compact = false,
  excludeSelf = false,
}) {
  const { user } = useAuth();
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const { data } = useGetOnlineUsersQuery(undefined, {
    pollingInterval: POLLING_INTERVALS.ONLINE_USERS_MS,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    skip: !user || !isAdmin,
  });

  const list = data?.data ?? data ?? [];
  const online = Array.isArray(list) ? list : [];

  if (!user || !isAdmin) return null;

  const filtered = excludeSelf
    ? online.filter((u) => {
        const uid = String(u.userId ?? u.id ?? '');
        return user?.id == null || uid !== String(user.id);
      })
    : online;

  if (filtered.length === 0) return null;

  const visible = filtered.slice(0, MAX_VISIBLE);
  const overflow = filtered.length - visible.length;
  const sizeClass = compact ? 'h-7 w-7 text-[10px]' : 'h-8 w-8 text-[10px]';
  const overlapClass = compact ? '-space-x-2' : '-space-x-3';

  return (
    <div
      className={cn('flex items-center', className)}
      title={`${filtered.length} team member${filtered.length === 1 ? '' : 's'} online`}
    >
      <div className={cn('flex items-center', overlapClass)}>
        <AnimatePresence mode="popLayout">
          {visible.map((u, idx) => {
            const uid = String(u.userId ?? u.id ?? idx);
            const initials = getUserInitials(u);
            const colorClass = getAvatarColorClass(uid);

            return (
              <motion.div
                key={uid}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                title={`${u.fullName} (${getRoleLabel(u.role)}) — online`}
                className={cn(
                  'relative flex items-center justify-center rounded-full font-semibold text-white shadow-sm ring-2 ring-white transition-transform hover:z-10 hover:scale-105',
                  sizeClass,
                  colorClass
                )}
              >
                {initials}
                <OnlineStatusDot />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {overflow > 0 && (
          <div
            className={cn(
              'relative z-0 flex items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-600 ring-2 ring-white',
              sizeClass,
              'text-[10px]'
            )}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
