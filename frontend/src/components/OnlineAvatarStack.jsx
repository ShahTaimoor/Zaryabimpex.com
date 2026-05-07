import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useGetOnlineUsersQuery } from '../store/services/presenceApi';
import { getRoleLabel } from '../utils/roleLabels';
import { cn } from '@/lib/utils';
import { POLLING_INTERVALS } from '../config/polling';

const BG_CLASSES = [
  'bg-gray-100',
];

function hashPick(str, mod) {
  let h = 0;
  if (!str) return 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % mod;
}

function getInitials(fullName) {
  const n = String(fullName || '').trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  return '?';
}

const MAX_VISIBLE = 4;

export default function OnlineAvatarStack({ className = '' }) {
  const { user } = useAuth();
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const { data, isFetching } = useGetOnlineUsersQuery(undefined, {
    pollingInterval: POLLING_INTERVALS.ONLINE_USERS_MS,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    skip: !user || !isAdmin,
  });

  const list = data?.data ?? data ?? [];
  const online = Array.isArray(list) ? list : [];

  if (!user || !isAdmin) return null;

  const visible = online.slice(0, MAX_VISIBLE);
  const overflow = online.length - visible.length;

  return (
    <div className={cn("flex items-center gap-3 px-2 py-1 rounded-full bg-gray-50/50 backdrop-blur-sm transition-all hover:bg-gray-100/50", className)}>
      <div className="flex items-center -space-x-3">
        <AnimatePresence mode="popLayout">
          {visible.map((u, idx) => {
            const uid = String(u.userId ?? u.id ?? idx);
            const isSelf = user?.id != null && String(user.id) === uid;
            const initials = getInitials(u.fullName);
            const bg = BG_CLASSES[hashPick(uid, BG_CLASSES.length)];

            return (
              <motion.div
                key={uid}
                layout
                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 10 }}
                title={`${u.fullName} (${getRoleLabel(u.role)})${isSelf ? ' - You' : ''}`}
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full border border-black text-[10px] font-bold text-black shadow-sm cursor-pointer transition-transform hover:scale-110 hover:z-50",
                  bg,
                  isSelf && "z-40"
                )}
              >
                {initials}
                {isSelf && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border border-black"></span>
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {overflow > 0 && (
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-black bg-gray-100 text-[10px] font-bold text-black shadow-sm z-0">
            +{overflow}
          </div>
        )}
      </div>

    </div>
  );
}
