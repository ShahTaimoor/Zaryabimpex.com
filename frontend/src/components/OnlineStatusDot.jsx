import React, { memo } from 'react';
import { cn } from '@/lib/utils';

export const OnlineStatusDot = memo(function OnlineStatusDot({ className = '' }) {
  return (
    <span
      className={cn(
        'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500',
        className
      )}
      aria-hidden
    />
  );
});

export default OnlineStatusDot;
